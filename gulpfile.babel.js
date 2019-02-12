import { dest, series, src } from 'gulp';
import babel from 'gulp-babel';
import del from 'gulp-clean';
import eslint from 'gulp-eslint';
import rename from 'gulp-rename';
import sourcemaps from 'gulp-sourcemaps';

function build () {
	return src('src/**/*.js')
		.pipe(sourcemaps.init())
		.pipe(babel())
		.pipe(sourcemaps.write('.'))
		.pipe(dest('dist'));
}

function buildExamples () {
	return src(['examples/client.js', 'examples/server.js'])
		.pipe(babel())
		.pipe(dest('examples-dist'));
}

function clean () {
	return src(['dist', 'examples-dist', 'reports'], { allowEmpty : true, read : false })
		.pipe(del());
}

function lint () {
	return src(['gulpfile.babel.js', 'src/**/*.js', 'test/**/*.js'])
		.pipe(eslint())
		.pipe(eslint.format())
		.pipe(eslint.failAfterError());
}

function renameExamples () {
	return src(['examples-dist/*.js'])
		.pipe(rename({
			suffix : '-transpiled'
		}))
		.pipe(dest('examples'));
}

exports.build = build;
exports.buildExamples = series(clean, buildExamples, renameExamples);
exports.clean = clean;
exports.default = series(clean, lint, build);
exports.lint = lint;
