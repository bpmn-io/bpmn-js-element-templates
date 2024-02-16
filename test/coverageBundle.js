const allTests = import.meta.webpackContext('./spec', {
  recursive: true,
  regExp: /.spec\.js$/
});

allTests.keys().forEach(allTests);

const allSources = import.meta.webpackContext('../src', {
  recursive: true,
  regExp: /.*\.js$/
});

allSources.keys().forEach(allSources);