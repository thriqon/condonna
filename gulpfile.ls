
require! {
	gulp
	'gulp-writ': writ
	'gulp-rename': rename
	'gulp-uglify': uglify
	'gulp-livescript': livescript
	'gulp-umd': umd
	'gulp-mocha': mocha
}

gulp.task \default, <[ build ]>

gulp.task \build ->
	gulp.src 'README.md'
		.pipe writ!
		.pipe livescript(bare: true)
		.pipe umd(exports: -> 'Condanna', namespace: -> 'Condanna')
		.pipe rename('condanna.js')
		.pipe gulp.dest('dist/')
		.pipe uglify(hoist_vars: true, unsafe: true)
		.pipe rename('condanna.min.js')
		.pipe gulp.dest('dist/')

gulp.task \tests, <[ build ]>, ->
	gulp.src './test/suite.js', read: false
		.pipe mocha(reporter: \dot)

