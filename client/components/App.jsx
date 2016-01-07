const BS = ReactBootstrap;
const RRBS = ReactRouterBootstrap;
const {Link} = ReactRouter;

SharedNavbar = React.createClass({
  mixins: [ReactMeteorData],
  getMeteorData() {
    var userId = Meteor.userId();
    var profileSub = Meteor.subscribe('mongo.profiles', {_id: userId});
    var profile = Models.Profiles.findOne(userId);
    var displayName = profile && profile.displayName || 'loading...';
    return {
      userId,
      displayName,
    };
  },

  logout() {
    Meteor.logout();
  },

  render() {
    return (
      <BS.Navbar fixedTop>
        <BS.Navbar.Header>
          <BS.Navbar.Brand>
            <RRBS.LinkContainer to='/'>
              <img src="/images/brand.png"/>
            </RRBS.LinkContainer>
          </BS.Navbar.Brand>
        </BS.Navbar.Header>
        <BS.Navbar.Collapse>
          {/* TODO: Construct some sort of breadcrumbs here? */}
          <BS.Nav>
            <RRBS.LinkContainer to='/hunts'>
              <BS.NavItem>
                Hunts
              </BS.NavItem>
            </RRBS.LinkContainer>
            <RRBS.LinkContainer to='/users/invite'>
              <BS.NavItem>
                Invite
              </BS.NavItem>
            </RRBS.LinkContainer>
            <RRBS.LinkContainer to='/users/'>
              <BS.NavItem>
                Hunters
              </BS.NavItem>
            </RRBS.LinkContainer>
          </BS.Nav>
          <BS.Nav pullRight>
            <BS.DropdownButton id='profileDropdown' bsStyle='default' title={this.data.displayName} navbar={true} className="navbar-btn">
              <RRBS.LinkContainer to={`/users/${this.data.userId}`}>
                <BS.MenuItem eventKey="1">My Profile</BS.MenuItem>
              </RRBS.LinkContainer>
              <BS.MenuItem eventKey="2" onSelect={this.logout}>Sign out</BS.MenuItem>
            </BS.DropdownButton>
          </BS.Nav>
        </BS.Navbar.Collapse>
      </BS.Navbar>
    );
  },
});

// TODO: clean this up and dedupe navbar stuff when you figure out breadcrumbs
FullscreenLayout = React.createClass({
  render() {
    return (
      <div>
        <SharedNavbar {...this.props} />
        <div style={{position: 'fixed', top: '50', left: '0', right: '0', zIndex: '1'}}>
          <ConnectionStatus/>
        </div>
        <div style={{position: 'fixed', top: '50', bottom: '0', left: '0', right: '0'}}>
          {this.props.children}
        </div>
      </div>
    );
  },
});

ScrollableLayout = React.createClass({
  render() {
    return (
      <div>
        <SharedNavbar {...this.props} />
        <div className="container" style={{paddingTop: 70}}>
          <ConnectionStatus/>
          {this.props.children}
        </div>
      </div>
    );
  },
});

App = React.createClass({
  propTypes: {
    history: React.PropTypes.object,
  },
  render() {
    // Hack: see if the leaf route wants the fullscreen layout.
    let routes = this.props.routes;
    let leafRoute = routes[routes.length - 1];
    let layout = leafRoute.component.desiredLayout;
    return (
      layout === 'fullscreen' ?
          <FullscreenLayout {...this.props}/> :
          <ScrollableLayout {...this.props}/>
    );
  },
});
