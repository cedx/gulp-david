/**
 * Build system.
 * @module gulpfile
 */
'use strict';

// Module dependencies.
const child=require('child_process');
const david=require('./index');
const del=require('del');
const gulp=require('gulp');
const plugins=require('gulp-load-plugins')();
const pkg=require('./package.json');
const util=require('util');

/**
 * Provides tasks for [Gulp.js](http://gulpjs.com) build system.
 * @class cli.Gulpfile
 * @static
 */

/**
 * The task settings.
 * @property config
 * @type Object
 */
const config={
  output: util.format('%s-%s.zip', pkg.name, pkg.version)
};

/**
 * Runs the default tasks.
 * @method default
 */
gulp.task('default', [ 'dist' ]);

/**
 * Checks the package dependencies.
 * @method check
 */
gulp.task('check', function() {
  return gulp.src('package.json')
    .pipe(david())
    .pipe(david.reporter);
});

/**
 * Deletes all generated files and reset any saved state.
 * @method clean
 */
gulp.task('clean', function(callback) {
  del('var/'+config.output, callback);
});

/**
 * Creates a distribution file for this program.
 * @method dist
 */
gulp.task('dist', function() {
  let sources=[
    '*.json',
    '*.md',
    '*.txt',
    'index.js',
    'example/*.js',
    'lib/*.js',
    'test/*.js'
  ];

  return gulp.src(sources, { base: '.' })
    .pipe(plugins.zip(config.output))
    .pipe(gulp.dest('var'));
});

/**
 * Builds the documentation.
 * @method doc
 */
gulp.task('doc', [ 'doc:assets' ]);

gulp.task('doc:assets', [ 'doc:build' ], function() {
  return gulp.src([ 'web/apple-touch-icon.png', 'web/favicon.ico' ])
    .pipe(gulp.dest('doc/api'));
});

gulp.task('doc:build', function(callback) {
  _exec('jsdoc --configure doc/conf.json', callback);
});

/**
 * Performs static analysis of source code.
 * @method lint
 */
gulp.task('lint', function() {
  return gulp.src([ '*.js', 'example/*.js', 'lib/*.js', 'test/*.js' ])
    .pipe(plugins.jshint(pkg.jshintConfig))
    .pipe(plugins.jshint.reporter('default', { verbose: true }));
});

/**
 * Runs the unit tests.
 * @method test
 */
gulp.task('test', function() {
  return gulp.src([ 'test/*.js' ], { read: false })
    .pipe(plugins.mocha());
});

/**
 * Runs a command and prints its output.
 * @method _exec
 * @param {String} command The command to run, with space-separated arguments.
 * @param {Function} callback The function to invoke when the task is over.
 * @async
 * @private
 */
function _exec(command, callback) {
  child.exec(command, function(err, stdout) {
    let output=stdout.trim();
    if(output.length) console.log(output);
    if(err) console.error(err);
    callback();
  });
}
