const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('script.js', 'utf8');

const dom = new JSDOM(html, {
    runScripts: "dangerously",
    resources: "usable",
    url: "http://localhost/"
});

dom.window.eval(`
  window.localStorage = {
    getItem: function(k) { return null; },
    setItem: function(k, v) {}
  };
  window.fetch = async function(url) {
    return {
      ok: true,
      json: async () => ({ results: [], genres: [] })
    };
  };
`);

try {
    dom.window.eval(script);
    console.log('Script parsed and evaluated without crashing immediately.');

    const event = dom.window.document.createEvent('Event');
    event.initEvent('DOMContentLoaded', true, true);
    dom.window.document.dispatchEvent(event);

    console.log('DOMContentLoaded fired without crashing.');

    // Check if API calls resolve without error
    setTimeout(() => {
        console.log('All done testing. No crashes detected!');
    }, 100);

} catch (e) {
    console.error("FATAL ERROR IN SCRIPT:", e);
}
