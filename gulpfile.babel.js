import babel from 'gulp-babel';
import del from 'del';
import eslint from 'gulp-eslint';
import gulp from 'gulp';
import sourcemaps from 'gulp-sourcemaps';

module.exports = (() => {
	gulp.task('build', ['clean-build'], () => {
		return gulp
			.src('src/**/*.js')
			.pipe(sourcemaps.init())
			.pipe(babel({
				presets: ['es2015', 'stage-0']
			}))
			.pipe(sourcemaps.write('.'))
			.pipe(gulp.dest('dist'));
	});

	gulp.task('clean-build', () => del('dist'));

	gulp.task('lint', () => {
		return gulp
			.src(['src/**/*.js', 'test/**/*.js', '!node_modules/**', '!reports/**', '!test/examples/*transpiled.js'])
			.pipe(eslint())
			.pipe(eslint.format())
			.pipe(eslint.failAfterError());
	});
})();
