import { _ } from 'meteor/underscore';
import React from 'react';
import PropTypes from 'prop-types';
import Alert from 'react-bootstrap/lib/Alert';
import ControlLabel from 'react-bootstrap/lib/ControlLabel';
import FormControl from 'react-bootstrap/lib/FormControl';
import FormGroup from 'react-bootstrap/lib/FormGroup';
import Creatable from 'react-select/lib/Creatable';
import LabelledRadioGroup from './LabelledRadioGroup.jsx';
import ModalForm from './ModalForm.jsx';
import puzzleShape from './puzzleShape.js';
import tagShape from './tagShape.js';

/* eslint-disable max-len */

class PuzzleModalForm extends React.Component {
  static displayName = 'PuzzleModalForm';

  static propTypes = {
    huntId: PropTypes.string.isRequired,
    puzzle: PropTypes.shape(puzzleShape),
    tags: PropTypes.arrayOf( // All known tags for this hunt
      PropTypes.shape(tagShape).isRequired,
    ).isRequired,
    onSubmit: PropTypes.func.isRequired,
    showOnMount: PropTypes.bool,
  };

  constructor(props, context) {
    super(props, context);
    const state = {
      submitState: 'idle',
      errorMessage: '',
      titleDirty: false,
      urlDirty: false,
      tagsDirty: false,
    };

    this.formRef = React.createRef();

    if (props.puzzle) {
      this.state = _.extend(state, this.stateFromPuzzle(props.puzzle));
    } else {
      this.state = _.extend(state, {
        title: '',
        url: '',
        tags: [],
        docType: 'spreadsheet',
      });
    }
  }

  componentDidMount() {
    if (this.props.showOnMount) {
      this.show();
    }
  }

  onTitleChange = (event) => {
    this.setState({
      title: event.target.value,
      titleDirty: true,
    });
  };

  onUrlChange = (event) => {
    this.setState({
      url: event.target.value,
      urlDirty: true,
    });
  };

  onTagsChange = (value) => {
    this.setState({
      tags: value.map(v => v.value),
      tagsDirty: true,
    });
  };

  onDocTypeChange = (newValue) => {
    this.setState({
      docType: newValue,
    });
  };

  onFormSubmit = (callback) => {
    this.setState({ submitState: 'submitting' });
    const payload = {
      hunt: this.props.huntId,
      title: this.state.title,
      url: this.state.url,
      tags: this.state.tags,
    };
    if (this.state.docType) {
      payload.docType = this.state.docType;
    }
    this.props.onSubmit(payload, (error) => {
      if (error) {
        this.setState({
          submitState: 'failed',
          errorMessage: error.message,
        });
      } else {
        this.setState({
          submitState: 'idle',
          errorMessage: '',
          titleDirty: false,
          urlDirty: false,
          tagsDirty: false,
        });
        callback();
      }
    });
  };

  tagNamesForIds = (tagIds) => {
    const tagNames = {};
    _.each(this.props.tags, (t) => { tagNames[t._id] = t.name; });
    return tagIds.map(t => tagNames[t]);
  };

  stateFromPuzzle = (puzzle) => {
    return {
      title: puzzle.title,
      url: puzzle.url,
      tags: this.tagNamesForIds(puzzle.tags),
    };
  };

  show = () => {
    this.formRef.current.show();
  };

  currentTitle = () => {
    if (!this.state.titleDirty && this.props.puzzle) {
      return this.props.puzzle.title;
    } else {
      return this.state.title;
    }
  };

  currentUrl = () => {
    if (!this.state.urlDirty && this.props.puzzle) {
      return this.props.puzzle.url;
    } else {
      return this.state.url;
    }
  };

  currentTags = () => {
    if (!this.state.tagsDirty && this.props.puzzle) {
      return this.tagNamesForIds(this.props.puzzle.tags);
    } else {
      return this.state.tags;
    }
  };

  render() {
    const disableForm = this.state.submitState === 'submitting';

    const selectOptions = _.chain(this.props.tags)
      .map(t => t.name)
      .union(this.state.tags)
      .compact()
      .map((t) => {
        return { value: t, label: t };
      })
      .value();

    const docTypeSelector = (
      <FormGroup>
        <ControlLabel className="col-xs-3" htmlFor="jr-new-puzzle-doc-type">
          Document type
        </ControlLabel>
        <div className="col-xs-9">
          <LabelledRadioGroup
            header=""
            name="jr-new-puzzle-doc-type"
            options={[
              {
                value: 'spreadsheet',
                label: 'Spreadsheet',
              },
              {
                value: 'document',
                label: 'Document',
              },
            ]}
            initialValue={this.state.docType}
            help="This can't be changed once a puzzle has been created. Unless you're absolutely sure, use a spreadsheet. We only expect to use documents for administrivia."
            onChange={this.onDocTypeChange}
          />
        </div>
      </FormGroup>
    );

    return (
      <ModalForm
        ref={this.formRef}
        title={this.props.puzzle ? 'Edit puzzle' : 'Add puzzle'}
        onSubmit={this.onFormSubmit}
        submitDisabled={disableForm}
      >
        <FormGroup>
          <ControlLabel className="col-xs-3" htmlFor="jr-new-puzzle-title">
            Title
          </ControlLabel>
          <div className="col-xs-9">
            <FormControl
              id="jr-new-puzzle-title"
              type="text"
              autoFocus
              disabled={disableForm}
              onChange={this.onTitleChange}
              value={this.currentTitle()}
            />
          </div>
        </FormGroup>

        <FormGroup>
          <ControlLabel className="col-xs-3" htmlFor="jr-new-puzzle-url">
            URL
          </ControlLabel>
          <div className="col-xs-9">
            <FormControl
              id="jr-new-puzzle-url"
              type="text"
              disabled={disableForm}
              onChange={this.onUrlChange}
              value={this.currentUrl()}
            />
          </div>
        </FormGroup>

        <FormGroup>
          <ControlLabel className="col-xs-3" htmlFor="jr-new-puzzle-tags">
            Tags
          </ControlLabel>
          <div className="col-xs-9">
            <Creatable
              id="jr-new-puzzle-tags"
              options={selectOptions}
              isMulti
              disabled={disableForm}
              onChange={this.onTagsChange}
              value={this.currentTags().map((t) => { return { label: t, value: t }; })}
            />
          </div>
        </FormGroup>

        {!this.props.puzzle && docTypeSelector}

        {this.state.submitState === 'failed' && <Alert bsStyle="danger">{this.state.errorMessage}</Alert>}
      </ModalForm>
    );
  }
}

export default PuzzleModalForm;
