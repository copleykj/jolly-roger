import { Meteor } from 'meteor/meteor';
import { useSubscribe, useTracker } from 'meteor/react-meteor-data';
import { faBullhorn } from '@fortawesome/free-solid-svg-icons/faBullhorn';
import { faCaretDown } from '@fortawesome/free-solid-svg-icons/faCaretDown';
import { faEraser } from '@fortawesome/free-solid-svg-icons/faEraser';
import { faFaucet } from '@fortawesome/free-solid-svg-icons/faFaucet';
import { faMap } from '@fortawesome/free-solid-svg-icons/faMap';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faReceipt } from '@fortawesome/free-solid-svg-icons/faReceipt';
import { faUsers } from '@fortawesome/free-solid-svg-icons/faUsers';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, {
  useCallback, useEffect, useRef,
} from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import ButtonToolbar from 'react-bootstrap/ButtonToolbar';
import type { FormControlProps } from 'react-bootstrap/FormControl';
import FormControl from 'react-bootstrap/FormControl';
import FormGroup from 'react-bootstrap/FormGroup';
import FormLabel from 'react-bootstrap/FormLabel';
import InputGroup from 'react-bootstrap/InputGroup';
import ToggleButton from 'react-bootstrap/ToggleButton';
import ToggleButtonGroup from 'react-bootstrap/ToggleButtonGroup';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import styled, { css } from 'styled-components';
import { sortedBy } from '../../lib/listUtils';
import Hunts from '../../lib/models/Hunts';
import Puzzles from '../../lib/models/Puzzles';
import Tags from '../../lib/models/Tags';
import { userMayWritePuzzlesForHunt } from '../../lib/permission_stubs';
import puzzleActivityForHunt from '../../lib/publications/puzzleActivityForHunt';
import { filteredPuzzleGroups, puzzleGroupsByRelevance } from '../../lib/puzzle-sort-and-group';
import type { PuzzleType } from '../../lib/schemas/Puzzle';
import { computeSolvedness } from '../../lib/solvedness';
import createPuzzle from '../../methods/createPuzzle';
import {
  useHuntPuzzleListCollapseGroups,
  useHuntPuzzleListDisplayMode,
  useHuntPuzzleListShowSolved,
  useOperatorActionsHiddenForHunt,
} from '../hooks/persisted-state';
import useTypedSubscribe from '../hooks/useTypedSubscribe';
import PuzzleList from './PuzzleList';
import type {
  PuzzleModalFormHandle, PuzzleModalFormSubmitPayload,
} from './PuzzleModalForm';
import PuzzleModalForm from './PuzzleModalForm';
import RelatedPuzzleGroup from './RelatedPuzzleGroup';
import { mediaBreakpointDown } from './styling/responsive';

const ViewControls = styled.div<{ $canAdd?: boolean }>`
  display: grid;
  grid-template-columns: auto auto auto 1fr;
  align-items: end;
  gap: 1em;
  margin-bottom: 1em;
  ${(props) => props.$canAdd && mediaBreakpointDown('xs', css`
    grid-template-columns: 1fr 1fr;
  `)}
  @media (max-width: 359px) {
    /* For very narrow viewports (like iPad Split View) */
    grid-template-columns: 100%;
  }

  .btn {
    /* Inputs and Button Toolbars are not quite the same height */
    padding-top: 7px;
    padding-bottom: 7px;
  }
`;

const SearchFormGroup = styled(FormGroup)<{ $canAdd?: boolean }>`
  grid-column: ${(props) => (props.$canAdd ? 1 : 3)} / -1;
  ${mediaBreakpointDown('sm', css`
    grid-column: 1 / -1;
  `)}
`;

const SearchFormLabel = styled(FormLabel)<{ $canAdd?: boolean }>`
  display: ${(props) => (props.$canAdd ? 'none' : 'inline-block')};
  ${mediaBreakpointDown('sm', css`
    display: none;
  `)}
`;

const OperatorActionsFormGroup = styled(FormGroup)`
  ${mediaBreakpointDown('xs', css`
    order: -1;
  `)}
`;

const AddPuzzleFormGroup = styled(FormGroup)`
  justify-self: end;
  ${mediaBreakpointDown('xs', css`
    justify-self: auto;
    order: -1;
  `)}
  @media (max-width: 359px) {
    order: -2;
  }
`;

const StyledToggleButtonGroup = styled(ToggleButtonGroup)`
  @media (max-width: 359px) {
    width: 100%;
  }
`;

const StyledButton = styled(Button)`
  @media (max-width: 359px) {
    width: 100%;
  }
`;

const PuzzleListToolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.5em;
`;

const PuzzleListView = ({
  huntId, canAdd, canUpdate,
}: {
  huntId: string
  canAdd: boolean;
  canUpdate: boolean;
}) => {
  const allPuzzles = useTracker(() => Puzzles.find({ hunt: huntId }).fetch(), [huntId]);
  const allTags = useTracker(() => Tags.find({ hunt: huntId }).fetch(), [huntId]);

  const deletedPuzzlesLoading = useSubscribe(
    canUpdate ? 'mongo.puzzles.deleted' : undefined,
    { hunt: huntId }
  );
  const deletedLoading = deletedPuzzlesLoading();
  const deletedPuzzles = useTracker(() => (
    !canUpdate || deletedLoading ?
      undefined :
      Puzzles.findDeleted({ hunt: huntId }).fetch()
  ), [canUpdate, huntId, deletedLoading]);

  const [searchParams, setSearchParams] = useSearchParams();
  const searchString = searchParams.get('q') ?? '';
  const addModalRef = useRef<PuzzleModalFormHandle>(null);
  const searchBarRef = useRef<HTMLInputElement>(null);
  const [displayMode, setDisplayMode] = useHuntPuzzleListDisplayMode(huntId);
  const [showSolved, setShowSolved] = useHuntPuzzleListShowSolved(huntId);
  const [huntPuzzleListCollapseGroups, setHuntPuzzleListCollapseGroups] =
    useHuntPuzzleListCollapseGroups(huntId);
  const expandAllGroups = useCallback(() => {
    setHuntPuzzleListCollapseGroups({});
  }, [setHuntPuzzleListCollapseGroups]);
  const canExpandAllGroups = displayMode === 'group' &&
    Object.values(huntPuzzleListCollapseGroups).some((collapsed) => collapsed);

  const [operatorActionsHidden, setOperatorActionsHidden] = useOperatorActionsHiddenForHunt(huntId);
  const setOperatorActionsHiddenString = useCallback((value: string) => {
    setOperatorActionsHidden(value === 'hide');
  }, [setOperatorActionsHidden]);

  const maybeStealCtrlF = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      const node = searchBarRef.current;
      if (node) {
        node.focus();
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', maybeStealCtrlF);
    return () => {
      window.removeEventListener('keydown', maybeStealCtrlF);
    };
  }, [maybeStealCtrlF]);

  const onAdd = useCallback((
    state: PuzzleModalFormSubmitPayload,
    callback: (error?: Error) => void
  ) => {
    const { docType, ...rest } = state;
    if (!docType) {
      callback(new Error('No docType provided'));
      return;
    }

    createPuzzle.call({ docType, ...rest }, callback);
  }, []);

  const setSearchString = useCallback((val: string) => {
    const u = new URLSearchParams(searchParams);
    if (val) {
      u.set('q', val);
    } else {
      u.delete('q');
    }

    setSearchParams(u);
  }, [searchParams, setSearchParams]);

  const onSearchStringChange: NonNullable<FormControlProps['onChange']> = useCallback((e) => {
    setSearchString(e.currentTarget.value);
  }, [setSearchString]);

  const compileMatcher = useCallback((searchKeys: string[]): (p: PuzzleType) => boolean => {
    const tagNames: Record<string, string> = {};
    allTags.forEach((t) => {
      tagNames[t._id] = t.name.toLowerCase();
    });
    const lowerSearchKeys = searchKeys.map((key) => key.toLowerCase());
    return function (puzzle) {
      const titleWords = puzzle.title.toLowerCase().split(' ');
      return lowerSearchKeys.every((key) => {
        // Every key should match at least one of the following:
        // * prefix of word in title
        // * substring of any answer
        // * substring of any tag
        if (titleWords.some((word) => word.startsWith(key))) {
          return true;
        }

        if (puzzle.answers.some((answer) => { return answer.toLowerCase().includes(key); })) {
          return true;
        }

        const tagMatch = puzzle.tags.some((tagId) => {
          const tagName = tagNames[tagId];
          return tagName?.includes(key);
        });

        if (tagMatch) {
          return true;
        }

        return false;
      });
    };
  }, [allTags]);

  const puzzlesMatchingSearchString = useCallback((puzzles: PuzzleType[]): PuzzleType[] => {
    const searchKeys = searchString.split(' ');
    if (searchKeys.length === 1 && searchKeys[0] === '') {
      // No search query, so no need to do fancy search computation
      return puzzles;
    } else {
      const searchKeysWithEmptyKeysRemoved = searchKeys.filter((key) => { return key.length > 0; });
      const isInteresting = compileMatcher(searchKeysWithEmptyKeysRemoved);
      return puzzles.filter(isInteresting);
    }
  }, [searchString, compileMatcher]);

  const puzzlesMatchingSolvedFilter = useCallback((puzzles: PuzzleType[]): PuzzleType[] => {
    if (showSolved) {
      return puzzles;
    } else {
      return puzzles.filter((puzzle) => {
        // Items with no expected answer are always shown, since they're
        // generally pinned administrivia.
        const solvedness = computeSolvedness(puzzle);
        return solvedness !== 'solved';
      });
    }
  }, [showSolved]);

  const clearSearch = useCallback(() => {
    setSearchString('');
  }, [setSearchString]);

  const setShowSolvedString = useCallback((value: string) => {
    setShowSolved(value === 'show');
  }, [setShowSolved]);

  const showAddModal = useCallback(() => {
    if (addModalRef.current) {
      addModalRef.current.show();
    }
  }, []);

  const renderList = useCallback((
    retainedPuzzles: PuzzleType[],
    solvedOverConstrains: boolean,
    allPuzzlesCount: number
  ) => {
    const maybeMatchWarning = solvedOverConstrains && (
      <Alert variant="info">
        No matches found in unsolved puzzles; showing matches from solved puzzles
      </Alert>
    );
    const retainedIds = new Set(retainedPuzzles.map((puzzle) => puzzle._id));
    const filterMessage = `Showing ${retainedPuzzles.length} of ${allPuzzlesCount} items`;

    let listComponent;
    let listControls;
    switch (displayMode) { // eslint-disable-line default-case
      case 'group': {
        // We group and sort first, and only filter afterward, to avoid losing the
        // relative group structure as a result of removing some puzzles from
        // consideration.
        const unfilteredGroups = puzzleGroupsByRelevance(allPuzzles, allTags);
        const puzzleGroups = filteredPuzzleGroups(unfilteredGroups, retainedIds);
        listComponent = puzzleGroups.map((g) => {
          const suppressedTagIds = [];
          if (g.sharedTag) {
            suppressedTagIds.push(g.sharedTag._id);
          }
          return (
            <RelatedPuzzleGroup
              key={g.sharedTag ? g.sharedTag._id : 'ungrouped'}
              huntId={huntId}
              group={g}
              noSharedTagLabel="(no group specified)"
              allTags={allTags}
              includeCount={false}
              canUpdate={canUpdate}
              suppressedTagIds={suppressedTagIds}
              trackPersistentExpand={searchString === ''}
            />
          );
        });
        listControls = (
          <Button
            variant="secondary"
            size="sm"
            disabled={!canExpandAllGroups}
            onClick={expandAllGroups}
          >
            <FontAwesomeIcon icon={faCaretDown} />
            {' '}
            Expand all
          </Button>
        );
        break;
      }
      case 'unlock': {
        const puzzlesByUnlock = sortedBy(allPuzzles, (p) => { return p.createdAt; });
        const retainedPuzzlesByUnlock = puzzlesByUnlock.filter((p) => retainedIds.has(p._id));
        listComponent = (
          <PuzzleList
            puzzles={retainedPuzzlesByUnlock}
            allTags={allTags}
            canUpdate={canUpdate}
          />
        );
        listControls = null;
        break;
      }
    }
    return (
      <div>
        {maybeMatchWarning}
        <PuzzleListToolbar>
          <div>{listControls}</div>
          <div>{filterMessage}</div>
        </PuzzleListToolbar>
        {listComponent}
        {deletedPuzzles && deletedPuzzles.length > 0 && (
          <RelatedPuzzleGroup
            key="deleted"
            huntId={huntId}
            group={{ puzzles: deletedPuzzles, subgroups: [] }}
            noSharedTagLabel="Deleted puzzles (operator only)"
            allTags={allTags}
            includeCount={false}
            canUpdate={canUpdate}
            suppressedTagIds={[]}
            trackPersistentExpand={searchString !== ''}
          />
        )}
      </div>
    );
  }, [
    huntId,
    displayMode,
    allPuzzles,
    deletedPuzzles,
    allTags,
    canUpdate,
    searchString,
    canExpandAllGroups,
    expandAllGroups,
  ]);

  const addPuzzleContent = canAdd && (
    <>
      <PuzzleModalForm
        huntId={huntId}
        tags={allTags}
        ref={addModalRef}
        onSubmit={onAdd}
      />
      <OperatorActionsFormGroup>
        <FormLabel>Operator Interface</FormLabel>
        <ButtonToolbar>
          <StyledToggleButtonGroup type="radio" name="operator-actions" defaultValue="show" value={operatorActionsHidden ? 'hide' : 'show'} onChange={setOperatorActionsHiddenString}>
            <ToggleButton id="operator-actions-hide-button" variant="outline-info" value="hide">Off</ToggleButton>
            <ToggleButton id="operator-actions-show-button" variant="outline-info" value="show">On</ToggleButton>
          </StyledToggleButtonGroup>
        </ButtonToolbar>
      </OperatorActionsFormGroup>
      <AddPuzzleFormGroup>
        <StyledButton variant="primary" onClick={showAddModal}>
          <FontAwesomeIcon icon={faPlus} />
          {' '}
          Add a puzzle
        </StyledButton>
      </AddPuzzleFormGroup>
    </>
  );

  const matchingSearch = puzzlesMatchingSearchString(allPuzzles);
  const matchingSearchAndSolved = puzzlesMatchingSolvedFilter(matchingSearch);
  // Normally, we'll just show matchingSearchAndSolved, but if that produces
  // no results, and there *is* a solved puzzle that is not being displayed due
  // to the solved filter, then show that and a note that we're showing solved
  // puzzles because no unsolved puzzles matched.
  const solvedOverConstrains = matchingSearch.length > 0 && matchingSearchAndSolved.length === 0;
  const retainedPuzzles = solvedOverConstrains ? matchingSearch : matchingSearchAndSolved;

  return (
    <div>
      <ViewControls $canAdd={canAdd}>
        <FormGroup>
          <FormLabel>Organize by</FormLabel>
          <ButtonToolbar>
            <StyledToggleButtonGroup type="radio" name="puzzle-view" defaultValue="group" value={displayMode} onChange={setDisplayMode}>
              <ToggleButton id="view-group-button" variant="outline-info" value="group">Group</ToggleButton>
              <ToggleButton id="view-unlock-button" variant="outline-info" value="unlock">Unlock</ToggleButton>
            </StyledToggleButtonGroup>
          </ButtonToolbar>
        </FormGroup>
        <FormGroup>
          <FormLabel>Solved puzzles</FormLabel>
          <ButtonToolbar>
            <StyledToggleButtonGroup type="radio" name="show-solved" defaultValue="show" value={showSolved ? 'show' : 'hide'} onChange={setShowSolvedString}>
              <ToggleButton id="solved-hide-button" variant="outline-info" value="hide">Hidden</ToggleButton>
              <ToggleButton id="solved-show-button" variant="outline-info" value="show">Shown</ToggleButton>
            </StyledToggleButtonGroup>
          </ButtonToolbar>
        </FormGroup>
        {addPuzzleContent}
        <SearchFormGroup $canAdd={canAdd}>
          <SearchFormLabel $canAdd={canAdd}>Search</SearchFormLabel>
          <InputGroup>
            <FormControl
              id="jr-puzzle-search"
              as="input"
              type="text"
              ref={searchBarRef}
              placeholder="Filter by title, answer, or tag"
              value={searchString}
              onChange={onSearchStringChange}
            />
            <Button variant="secondary" onClick={clearSearch}>
              <FontAwesomeIcon icon={faEraser} />
            </Button>
          </InputGroup>
        </SearchFormGroup>
      </ViewControls>
      {renderList(retainedPuzzles, solvedOverConstrains, allPuzzles.length)}
    </div>
  );
};

const StyledPuzzleListLinkList = styled.ul`
  list-style: none;
  display: flex;
  align-items: stretch;
  flex-wrap: wrap;
  width: 100%;
  margin: 0 0 8px;
  padding: 0;
  border-color: #cfcfcf;
  border-style: solid;
  border-width: 1px 0;
`;

const StyledPuzzleListLink = styled.li`
  display: flex;
  align-items: stretch;
  flex: 1 1 0;
`;

const StyledPuzzleListLinkAnchor = styled(Link)`
  flex: 1 1 0;
  display: flex;
  height: 38px;
  align-items: center;
  align-content: center;
  justify-content: center;
  text-align: center;
  padding: 8px 0;
  font-size: 14px;
  font-weight: bold;

  &:hover {
    background-color: #f8f8f8;
  }
`;

const StyledPuzzleListExternalLink = styled(StyledPuzzleListLink)`
  flex: 0 0 40px;
`;

const StyledPuzzleListLinkLabel = styled.span`
  margin-left: 4px;
  ${mediaBreakpointDown('sm', css`
    display: none;
  `)}
`;

const PuzzleListPage = () => {
  const huntId = useParams<'huntId'>().huntId!;

  const puzzlesLoading = useSubscribe('mongo.puzzles', { hunt: huntId });
  const tagsLoading = useSubscribe('mongo.tags', { hunt: huntId });
  const loading = puzzlesLoading() || tagsLoading();

  // Don't bother including this in loading - it's ok if they trickle in
  useTypedSubscribe(puzzleActivityForHunt, { huntId });

  // Assertion is safe because hunt is already subscribed and checked by HuntApp
  const hunt = useTracker(() => Hunts.findOne(huntId)!, [huntId]);
  const { canAdd, canUpdate } = useTracker(() => {
    return {
      canAdd: userMayWritePuzzlesForHunt(Meteor.user(), hunt),
      canUpdate: userMayWritePuzzlesForHunt(Meteor.user(), hunt),
    };
  }, [hunt]);

  const huntLink = hunt.homepageUrl && (
    <StyledPuzzleListExternalLink>
      <Button as="a" href={hunt.homepageUrl} className="rounded-0" target="_blank" rel="noopener noreferrer" title="Open the hunt homepage">
        <FontAwesomeIcon icon={faMap} />
      </Button>
    </StyledPuzzleListExternalLink>
  );
  const puzzleList = loading ? (
    <span>loading...</span>
  ) : (
    <PuzzleListView
      huntId={huntId}
      canAdd={canAdd}
      canUpdate={canUpdate}
    />
  );
  return (
    <div>
      <StyledPuzzleListLinkList>
        {huntLink}
        <StyledPuzzleListLink>
          <StyledPuzzleListLinkAnchor to={`/hunts/${huntId}/announcements`}>
            <FontAwesomeIcon icon={faBullhorn} />
            <StyledPuzzleListLinkLabel>Announcements</StyledPuzzleListLinkLabel>
          </StyledPuzzleListLinkAnchor>
        </StyledPuzzleListLink>
        <StyledPuzzleListLink>
          <StyledPuzzleListLinkAnchor to={`/hunts/${huntId}/guesses`}>
            <FontAwesomeIcon icon={faReceipt} />
            <StyledPuzzleListLinkLabel>Guess queue</StyledPuzzleListLinkLabel>
          </StyledPuzzleListLinkAnchor>
        </StyledPuzzleListLink>
        <StyledPuzzleListLink>
          <StyledPuzzleListLinkAnchor to={`/hunts/${huntId}/hunters`}>
            <FontAwesomeIcon icon={faUsers} />
            <StyledPuzzleListLinkLabel>Hunters</StyledPuzzleListLinkLabel>
          </StyledPuzzleListLinkAnchor>
        </StyledPuzzleListLink>
        {/* Show firehose link only to operators */}
        {canUpdate && (
          <StyledPuzzleListLink>
            <StyledPuzzleListLinkAnchor to={`/hunts/${huntId}/firehose`}>
              <FontAwesomeIcon icon={faFaucet} />
              <StyledPuzzleListLinkLabel>Firehose</StyledPuzzleListLinkLabel>
            </StyledPuzzleListLinkAnchor>
          </StyledPuzzleListLink>
        )}
      </StyledPuzzleListLinkList>
      {puzzleList}
    </div>
  );
};

export default PuzzleListPage;
