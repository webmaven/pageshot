const React = require("react");

export class Shell extends React.Component {
  render() {
    if (this.props.children.length != 2) {
      throw new Error("Shell needs exactly two children (head and body)");
    }
    if (this.props.children[0].type != "head") {
      throw new Error("Shell first child must be <head> (not " + this.props.children[0].type + ")");
    }
    if (this.props.children[1].type != "body") {
      throw new Error("Shell second child must be <body> (not " + this.props.children[1].type + ")");
    }
    let gaScript = null;
    let gaCode = null;
    let gaJs;
    if (this.props.gaId) {
      if (this.props.gaId.search(/^[a-z0-9\-]+$/i) === -1) {
        // Doesn't look like a valid code
        console.warn("Invalid Google Analytics code:", this.props.gaId);
      }
      gaJs = `
       (function () {
         window.GoogleAnalyticsObject = "ga";
         window.ga = window.ga || function () {
           (window.ga.q = window.ga.q || []).push(arguments);
         };
         window.ga.l = 1 * new Date();
         var userId = "${this.props.deviceId}";
         var gaOptions = "auto";
         if (userId) {
           gaOptions = {userId: userId};
         }
         if (location.hostname === "localhost") {
           if (typeof gaOptions === "string") {
             gaOptions = {};
           }
           gaOptions.cookieDomain = "none";
         }
         ga("create", "${this.props.gaId}", gaOptions);
         ga("send", "pageview");
       })();
      `;
      gaScript = <script src="//www.google-analytics.com/analytics.js" async></script>;
    } else {
      gaJs = `
      window.ga = function () {
        console.info.apply(console, ["stubbed ga("].concat(arguments).concat([")"]));
      };
      `;
    }
    let js = [
      <link rel="stylesheet" href={ this.props.staticLink("vendor/introjs/introjs.css") } key="introjs-stylesheet" />,
      <script src={ this.props.staticLink("vendor/introjs/intro.js") } key="introjs-js" />,
      <script src={ this.props.staticLink("js/server-bundle.js") } key="server-bundle-js" />,
    ];
    if (this.props.simple) {
      js = null;
    }
    gaCode = <script dangerouslySetInnerHTML={{__html: gaJs}}></script>;
    return <html prefix="og: http://ogp.me/ns#">
      <head>
        <meta charSet="UTF-8" />
        <meta name="referrer" content="origin" />
        <title>{this.props.title}</title>
        {gaScript}
        {gaCode}
        {js}
        <link rel="stylesheet" href={ this.props.staticLink("css/styles.css") } />
        <link rel="stylesheet" href={ this.props.staticLink("css/profile.css") } />
        {this.props.children[0].props.children}
      </head>
      <body>
        {this.props.children[1].props.children}
      </body>
    </html>;
  }
}
