/* eslint-disable es5/no-template-literals */


module.exports = function (grunt) {

    var source = grunt.option("source") || "pfsense.js";
    var action = grunt.option("action") || "status";
    console.log(process.argv);
    grunt.initConfig({
        copy: {
            files:
        // includes files within path
        { expand: true, src: ["lib/*"], dest: "dist/", filter: "isFile", flatten: true },

        },
        uglify: {
            my_target: {
                options: {
                    beautify: true,
                    sourceMapName: "dist/main.map",
                    sourceMap: {
                        includeSources: true
                    },
                    mangle: false
                },
                files: {
                    "dist/main.min.js": ["lib/d.js", "src/" + source, `lib/${action}.js`]
                }
            }
        }
    });
    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.registerTask("default", ["uglify"]);
};