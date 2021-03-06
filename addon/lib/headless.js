/* Headless server, for use with Pageshot:
 *  https://github.com/mozilla-services/pageshot
 * Relies on the server module from mozilla testing:
 *  http://mxr.mozilla.org/mozilla-central/source/netwerk/test/httpserver/
 *
 * Listening IP address may be assigned to httpd, by default it is localhost. 
 * The default is used in this implementation.
 *    For more info:
 *    http://mxr.mozilla.org/mozilla-central/source/netwerk/test/httpserver/nsIHttpServer.idl#282
 *
 * TODO:
 *    Documentation
 *    Check URL before opening
 *    Fix autoShot - currently it leaves some errors about attrs
 *    Add preference for whether or not headless should run
 *    Reimplement contentServerString?
 * 
 * General usage: 
 * When you make an HTTP request to this server on the appropriate port it will
 * look for a query string and attempt to open the string as a URL, return a
 * URL of where to find it when processing is done, and process the tab with
 * an automatic shot function.
 *
 * Generally CSS parsing is enabled on this branch, which is EXPERIMENTAL.
 *
 * Syntax, assuming default IP, PORT, and target URL of asdf.com:
 *    curl 'http://localhost:10082/?http://www.asdf.com' 
 *
 * Usage without X:
 * To use this without X, start the server as normal. Then, in the bin/
 * directory, run `sh ephemeral-x.sh ./run-addon`.
 */

const { Cc, Ci, Cu } = require("chrome");
const tabs = require("sdk/tabs");

const HTTPD_MOD_URL = module.uri.replace("/headless.js", "/httpd.jsm");
const { nsHttpServer } = Cu.import(HTTPD_MOD_URL);

const { randomString } = require("./randomstring");
const { autoShot, RANDOM_STRING_LENGTH, urlDomainForId } = require("./shooter");
const { prefs } = require("sdk/simple-prefs");

var ip = prefs.httpServerIp;
var port = prefs.httpServerPort;
var backend = prefs.backend;    // set global backend, handleRequest needs it

exports.init = function init() {
  /* Initializes the backend server, which listens for requests made to / and
   * passes them to the handleRequest function below
   */
  if (!prefs.startHttpServer) { return; }
  console.info("starting headless server on IP:PORT"
                                                    .replace('IP', ip)
                                                    .replace('PORT', port));
  var server = new nsHttpServer();
  if (ip != "localhost") { server.identity.add("http", ip, port); }
  server.start(port);
  server.registerPathHandler('/', handleRequest);
};

function handleRequest(request, response) {
  /* Takes a request from the server, makes the response asynchronous so the
   * client waits for a response, processes the query string from the request
   * as a URL with the function autoShot from shooter.js and finally returns a
   * URL which the processed content may be found at
   */
  response.processAsync();
  var url = request._queryString;
  var backendUrl = randomString(RANDOM_STRING_LENGTH) + "/" + urlDomainForId(url);
  console.log('recieved request: URL -> BACK'
                .replace('URL', url).replace('BACK', backendUrl));
  tabs.open({
    "url": url,
    "onLoad": function (tab) {
      autoShot(tab, backend, backendUrl);
      tab.on("close", function (a) {
        console.log('completed processing BACK'.replace('BACK', backendUrl));
        response.setStatusLine("1.1", 200, "OK");
        response.write(backendUrl + '\n');
        response.finish();
      });
    }
  });
}
