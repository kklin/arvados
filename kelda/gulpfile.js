const gulp = require('gulp');
const gulpIf = require('gulp-if');
const eslint = require('gulp-eslint');

const lintFiles = ['**/*.js', '!node_modules/**'];

/**
 * Determine whether eslint made changes to a gulp file.
 *
 * @param {Vinyl} file A gulp file potentially processed by eslint
 * @return {boolean} Whether eslint fixed the file
 */
function isFixed(file) {
  return file.eslint != null && file.eslint.fixed;
}


gulp.task('default', ['lint']);

gulp.task('lint', () => gulp.src(lintFiles)
  .pipe(eslint())
  .pipe(eslint.format()) // Output the lint results to the console.
  .pipe(eslint.failAfterError()));

gulp.task('lint-fix', () =>
  gulp.src(lintFiles)
    .pipe(eslint({ fix: true }))
    .pipe(eslint.format()) // Output the lint results to the console.
    .pipe(gulpIf(isFixed, gulp.dest('.'))) // Write the fixed files.
    .pipe(eslint.failAfterError()));
