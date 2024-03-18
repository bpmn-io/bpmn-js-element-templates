const allTests = import.meta.webpackContext('./spec', {
  recursive: true,
  regExp: /.spec\.js$/
});

allTests.keys().forEach(allTests);