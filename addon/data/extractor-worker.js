/* globals Readability, microformats, watchFunction */
/* exported FILENAME */
/** extractor-worker is a content worker that is attached to a page when
    making a shot

    extractData() does the main work
    */

// Set for use in error messages:
var FILENAME = "extractor-worker.js";

/** Extracts data:
    - Gets the Readability version of the page (`.readable`)
    - Parses out microformats (`.microdata`)
    - Finds images in roughly the preferred order (`.images`)
    */
function extractData() {
  let start = Date.now();
  // Readability is destructive, so we have to run it on a copy
  var readableDiv = document.createElement("div");
  readableDiv.innerHTML = document.body.innerHTML;
  // FIXME: location.href isn't what Readability expects (but I am
  // working around the parts of the code that seem to expect
  // something different)
  let startReader = Date.now();
  let uri = {
    spec: location.href,
    host: location.host,
    prePath: location.scheme + "://" + location.host,
    scheme: location.scheme,
    pathBase: location.href.replace(/\/[^\/]*$/, "/")
  };
  var reader = new Readability(uri, readableDiv);
  var readable = reader.parse();
  if (readable) {
    delete readable.uri;
  }
  console.info("Readability time:", Date.now() - startReader, "ms", "success:", !! readable);
  let startMicro = Date.now();
  var microdata = microformats.getItems();
  console.info("Microdata time:", Date.now() - startMicro, "ms");
  // FIXME: need to include found images too
  let startImage = Date.now();
  var images = findImages([
    {element: document.head, isReadable: false},
    {element: readableDiv, isReadable: true},
    {element: document.body, isReadable: false}]);
  console.info("Image time:", Date.now() - startImage, "ms");
  var siteName = findSiteName();
  console.info("extractData time:", Date.now() - start, "ms");
  let passwordFields = [];
  for (let el of document.querySelectorAll('input[type=password]')) {
    passwordFields.push(el.name || null);
  }
  return {
    readable: readable,
    microdata: microdata,
    images: images,
    siteName: siteName,
    passwordFields: passwordFields
  };
}

// Images smaller than either of these sizes are skipped:
var MIN_IMAGE_WIDTH = 250;
var MIN_IMAGE_HEIGHT = 200;

/** Finds images in any of the given elements, avoiding duplicates
    Looks for Open Graph og:image, then img elements, sorting img
    elements by width (largest preferred) */
function findImages(elements) {
  var images = [];
  var found = {};
  function addImage(imgData) {
    if (! (imgData && imgData.url)) {
      return;
    }
    // FIXME: handle relative links
    if (found[imgData.url]) {
      return;
    }
    images.push(imgData);
    found[imgData.url] = true;
  }
  for (var i=0; i<elements.length; i++) {
    var el = elements[i].element;
    var isReadable = elements[i].isReadable;
    var ogs = el.querySelectorAll("meta[property='og:image'], meta[name='twitter:image']");
    var j;
    for (j=0; j<ogs.length; j++) {
      var src = ogs[j].getAttribute("content");
      if (src.startsWith("/")) {
        src = location.origin + src;
      }
      addImage({
        url: src
      });
    }
    var imgs = el.querySelectorAll("img");
    imgs = Array.prototype.slice.call(imgs);
    // Widest images first:
    imgs.sort(function (a, b) {
      if (a.width > b.width) {
        return -1;
      }
      return 1;
    });
    for (j=0; j<imgs.length; j++) {
      var img = imgs[j];
      if (img.width >= MIN_IMAGE_WIDTH && img.height >= MIN_IMAGE_HEIGHT) {
        addImage({
          url: img.src,
          dimensions: {x: img.width, y: img.height},
          title: img.getAttribute("title") || null,
          alt: img.getAttribute("alt") || null,
          isReadable: isReadable
        });
      }
    }
  }
  return images;
}

function findSiteName() {
  let el = document.querySelector("meta[property='og:site_name']");
  if (el) {
    return el.getAttribute("content");
  }
  // nytimes.com uses this property:
  el = document.querySelector("meta[name='cre']");
  if (el) {
    return el.getAttribute("content");
  }
  return null;
}

self.port.emit("data", watchFunction(extractData)());
