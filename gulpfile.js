// gulpfile.js
//

var del  = require('del');
var path = require('path');

var gulp = require('gulp');

var browserSync        = require('browser-sync').create('collider');
var changed            = require('gulp-changed');
var commonjs           = require('rollup-plugin-commonjs');
var flatten            = require('gulp-flatten');
var ghPages            = require('gulp-gh-pages');
var handlebars         = require('gulp-hb');
var htmlmin            = require('gulp-htmlmin');
var NotificationCenter = require('node-notifier').NotificationCenter;
var plumber            = require('gulp-plumber');
var resolveAliases     = require('rollup-plugin-resolve-aliases');
var rollup             = require('rollup').rollup;
var sass               = require('gulp-sass');
var sourcemaps         = require('gulp-sourcemaps');

// PostCSS
var postcss  = require('gulp-postcss');
var cssnano  = require('cssnano');
var prefixer = require('autoprefixer');

function reloadBrowser(cb) {
  browserSync.reload();
  cb();
}

// Error Handling
//

var errorNotifier = new NotificationCenter();

function printError(msg) {
  console.error();
  console.error('[Collider]', 'Error:', msg);
  console.error();
}

function logError(err) {

  switch (err.plugin) {
    case 'gulp-hb':
      errorNotifier.notify({
        title: 'Collider',
        message: 'There was an error with Handlebars. See Log.',
      });
      printError(err.message);
      break;

    case 'gulp-sass':
      errorNotifier.notify({
        title: 'Collider',
        message: 'There was an error with Sass. See Log.',
      });
      printError(err.message);
      break;

    default:
      errorNotifier.notify({
        title: 'Collider',
        message: 'There was an error. See Log.',
      });
      printError(err.message);
  }
}

var src   = 'project';
var build = 'distribute';

// SERVE
//

gulp.task('serve', function (cb) {

  browserSync.init({
    server: {
      baseDir: build,
    },
    ghostMode:       false,
    logPrefix:       'Collider',
    online:          false,
    open:            'local',
    reloadOnRestart: true,
    notify:          false,
    reloadDebounce:  1000,
  }, cb);
});

// HANDLEBARS
//

gulp.task('handlebars', function () {

  var handlebarsStream = handlebars({
    bustCache: true,
    debug: 0,
  })
    .helpers('collider/helpers/*.js')

    // Register Project's common partials.
    .partials(`${src}/common/*.hbs`, { base: path.join(__dirname, 'project/common') })

    // Register Project and 3rd-party Matter.
    .partials('+(project|*-matter)/matter/{atoms,molecules,organisms}/**/*.hbs', { base: __dirname })

    // Register Project and 3rd-party Matter data.
    .data('+(project|*-matter)/data/{atoms,molecules,organisms}/*.json', { base: __dirname });

  var htmlminConfig = {
    removeComments: true,
    collapseWhitespace: true,
  };

  return gulp
    .src(`${src}/**/*.html`)
    .pipe(plumber(logError))
    .pipe(handlebarsStream)
    .pipe(htmlmin(htmlminConfig))
    .pipe(gulp.dest(build));
});

// SASS
//

gulp.task('sass', function () {

  var cssProcessors = [
    prefixer({
      browsers: ['last 2 versions'],
      cascade: false,
    }),
    cssnano({
      safe: true,
      discardComments: { removeAll: true },
    }),
  ];

  var sassStream = sass({
    outputStyle: 'compact',
  }).on('error', function (err) {
    this.emit('end');
  });

  return gulp
    .src(`${src}/main.scss`)
    .pipe(plumber(logError))
    .pipe(sourcemaps.init())
      .pipe(sassStream)
      .pipe(postcss(cssProcessors))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(`${build}/css`));
});

// CLEAN
//

gulp.task('clean', function () {
  return del(`${build}/**`);
});

gulp.task('clean:assets', function () {
  return del([
    `${build}/assets/**`,
    `!${build}/assets`,
  ]);
});

gulp.task('clean:js', function () {
  return del([
    `${build}/js/**`,
    `!${build}/js`,
  ]);
});

// ASSETS
//

gulp.task('assets', gulp.series('clean:assets', function () {

  return gulp
    .src('+(project|*-matter)/assets/**/*')
    .pipe(plumber(logError))
    .pipe(changed(build))
    .pipe(flatten({ includeParents: -1 }))
    .pipe(gulp.dest(`${build}/assets`));
}));

// JS
//

gulp.task('js', gulp.series('clean:js', function () {

  var rollupConfig = {
    entry: `${src}/main.js`,
    plugins: [
      commonjs(),
      resolveAliases({
        aliases: { jquery: 'collider/vendor/jquery-3.0.0.min.js' },
      }),
    ],
  };

  var writeBundle = function (bundle) {
    return bundle.write({
      format: 'iife',
      dest: `${build}/bundle.js`,
    });
  };

  return rollup(rollupConfig)
    .then(writeBundle);
}));

// WATCH
//

gulp.task('watch', function (cb) {

  var watchers = {
    handlebars: gulp.watch([
      'project/**/*.html',
      'project/common/*.hbs',
      '+(project|*-matter)/data/{atoms,molecules,organisms}/*.json',
      '+(project|*-matter)/matter/{atoms,molecules,organisms}/**/*.hbs',
    ], gulp.series('handlebars', reloadBrowser)),

    sass: gulp.watch([
      'collider/**/*.scss',
      '+(project|*-matter)/**/*.scss',
    ], gulp.series('sass', reloadBrowser)),

    js: gulp.watch([
      'collider/**/*.js',
      '+(project|*-matter)/**/*.js',
    ], gulp.series('js', reloadBrowser)),

    assets: gulp.watch([
      '+(project|*-matter)/assets/**/*',
    ], gulp.series('assets', reloadBrowser)),
  };

  cb();
});

// DEPLOY
// (Legacy)

gulp.task('deploy', function () {

  return gulp
    .src(`${build}/**/*`)
    .pipe(ghPages());
});

// BUILD
//

gulp.task('build', gulp.parallel('handlebars', 'sass', 'js', 'assets'));

// DEFAULT
//

gulp.task('default', gulp.series('clean', 'build', 'serve', 'watch'));
