/**
 * Require that documentation is kept up to date as the referenced files change.
 *
 * To do this, for each file in the docs directory, we look at the set of files
 * listed in the front matter and check when each of them last changed. If any
 * of them is more recent than either the last commit to the doc file or the
 * commit listed in the "updated" field (whichever is more recent), then the doc
 * is out of date.
 */
import child from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import matter from 'gray-matter';

const execFile = promisify(child.execFile);

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

interface NewerFile {
  file: string;
  commit: string;
}

type DocError = {
  type: 'out-of-date'
  doc: string;
  newerFiles: NewerFile[];
} | {
  type: 'missing-front-matter';
  doc: string;
} | {
  type: 'missing-updated-field';
  doc: string;
} | {
  type: 'missing-files';
  doc: string;
}

const checkDoc = async (doc: string): Promise<DocError | undefined> => {
  const docMatter = matter(await fs.readFile(doc));

  // First: figure out how recent the documentation is. This can either be the
  // "updated" field in the front matter, or, if the last commit to the file
  // contains the updated commit, the last commit.
  let docRevision: string = docMatter.data.updated;
  if (!docRevision || typeof docRevision !== 'string') {
    return {
      type: 'missing-updated-field',
      doc,
    };
  }

  const { stdout: fileRevision } = await execFile('git', ['rev-list', '-1', 'HEAD', `^${docRevision}`, '--', doc]);
  if (fileRevision.trim().length > 0) {
    docRevision = fileRevision.trim();
  }

  // Next: figure out if any of the referenced files are more recent than our
  // doc revision
  const files: string[] = docMatter.data.files;
  if (!files || !Array.isArray(files) || !files.every((file) => typeof file === 'string')) {
    return {
      type: 'missing-files',
      doc,
    };
  }

  const fileChecks = await Promise.all(files.map(async (file) => {
    const { stdout: updated } = await execFile('git', ['rev-list', '-1', 'HEAD', `^${docRevision}`, '--', file]);
    if (updated.trim().length > 0) {
      return { file, commit: updated.trim() };
    }

    return undefined;
  }));
  const newerFiles = fileChecks.filter((fc): fc is NewerFile => fc !== undefined);
  if (newerFiles.length > 0) {
    return {
      type: 'out-of-date',
      doc,
      newerFiles,
    };
  }

  return undefined;
};

const main = async () => {
  const docsDir = path.join(dirname, '..', 'docs');
  const docs = await fs.readdir(docsDir);

  const results = await Promise.all(docs.map((doc) => checkDoc(path.join(docsDir, doc))));
  const errors = results.filter((result): result is DocError => result !== undefined);

  if (errors.length > 0) {
    process.stderr.write('Documentation errors:\n\n');
    for (const error of errors) {
      switch (error.type) {
        case 'out-of-date':
          process.stderr.write(`  ${path.basename(error.doc)} is out of date\n`);
          for (const newerFile of error.newerFiles) {
            process.stderr.write(`    ${newerFile.file} was updated in ${newerFile.commit}\n`);
          }
          process.stderr.write(`  To fix this, either update ${path.basename(error.doc)} or, if no changes are needed, change the updated field to match the most recent commit to those files.\n`);
          break;
        case 'missing-front-matter':
          process.stderr.write(`  ${error.doc} is missing front matter\n`);
          break;
        case 'missing-updated-field':
          process.stderr.write(`  ${error.doc} is missing updated field\n`);
          break;
        case 'missing-files':
          process.stderr.write(`  ${error.doc} is missing files field\n`);
          break;
        default:
          process.stderr.write(`  unknown error type ${error}\n`);
      }
      process.stderr.write('\n');
    }

    process.exit(1);
  }

  process.exit(0);
};

await main();
