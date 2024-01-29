const allTests = require.context('./spec', true, /.spec\.js$/);

allTests.keys().forEach(allTests);