module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
      browserify: {
        dist: {
          files: {
            'build/public/js/index.js': ['src/public/js/index.js'],
            'build/public/js/index_mng.js': ['src/public/js/index_mng.js']
          }
        }
      },
      jscs: {
          src: ["src/dbtest.js", "src/lib/*.js", "src/public/js/index.js"],
          options: {
              config: ".jscsrc",
              esnext: true,
              verbose: true,
              fix: false,
              requireCurlyBraces: [ "if" ],
              preset: 'google'
          }
      },
      jshint: {
        files: ['src/dbtest.js', 'src/lib/*.js', 'src/public/index.js'],
        options: {
            force: 'yes'
        }
      },
      clean: {
        build: [
            'build'
        ]
      },
      copy: {
        main: {
          files: [{
             src: 'src/dbservers.json',
             dest: 'build/dbservers.json'
          },{
             src: 'src/dbtest.js',
             dest: 'build/dbtest.js'
          },{
             src: 'lib/*.js',
             dest: 'build/',
             cwd: 'src/',
             expand: true
          },{
             src: '*',
             dest: 'build/public/media',
             cwd: 'src/public/media',
             expand: true
          },{
             expand: true,
             cwd: 'src/',
             src: 'views/**',
             dest: 'build/'
          },{ // copy fonts
             expand: true,
             cwd: './node_modules/bootstrap/fonts/',
             src: '*',
             dest: 'build/public/fonts/'
          },{
             expand: true,
             cwd: './',
             src: './prod_app_container/**',
             dest: 'build/'
          },{
             expand: true,
             cwd: 'src/',
             src: 'data/**',
             dest: 'build/',
             filter: 'isDirectory'
          },{
             expand: true,
             src: "package.json",
             dest: 'build/'
          }]
        }
      },
      cssmin: {
        production: {
             expand: true,
             cwd: 'src/public/',
             src: ['css/*'],
             dest: 'build/public/'
        }
      },
      watch: {
        files: [
          '<%= jshint.files %>',
          'Gruntfile.js',
          'src/views/**',
          'src/public/**',
          'spec/**'],

      tasks: ['jshint', 'jscs','copy', 'cssmin', 'browserify']
      }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-ssh');
  grunt.loadNpmTasks('grunt-scp');
  grunt.loadNpmTasks('grunt-jscs');
  grunt.loadNpmTasks('grunt-browserify');

  // Default task(s).
  grunt.registerTask('default', ['copy', 'cssmin', 'browserify']);
};
