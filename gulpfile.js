var gulp = require('gulp');
var babel = require('gulp-babel');

var paths = {
    es6: 'src/*.js'
}

gulp.task('default', [
    'babel'
]);

/**
* Runs all source files through babel to compile es6 => es5.
*/
gulp.task('babel', function(){
    return gulp.src(paths.es6)
        .pipe(babel())
        .pipe(gulp.dest('dist'));
});

/**
* Compile es6 on the fly
*/
gulp.task('serve', ['default'], function() {
    gulp.watch(paths.es6, ['babel']);
});
