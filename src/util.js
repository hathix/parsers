var _ = require('lodash');

var util = {};

/**
 * Adds utility lodash functions to the lodash namespace. Call this once
 * atop a file that uses lodash.
 */
util.addLodashUtilities = () => {
    _.mixin({
        // unions all the component arrays of a list.
        // _.squish([[1,2],[2,3]]) == [1,2,3]
        'squish': function(list) {
            return _.reduce(list, (a, b) => _.union(a, b), []);
        },

        // returns all indices where an element occurs in a list
        // _.indicesOf([1,2,3,2], 2) == [1, 3]
        // _.indicesOf([1,2,3,2], 4) == []
        'indicesOf': function(list, needle) {
            return _.reduce(list, (memo, value, index) => {
                if (_.isEqual(value, needle)) {
                    memo.push(index);
                }
                return memo;
            }, []);
        }
    });
};

/**
 * Generates a 2D table using the Cartesian cross product of rowValues and
 * columnValues. For a given (rowValue, columnValue) pair, the cell
 * [rowLabelFn(rowValue), columnLabelFn(columnValue)] will have the value
 * cellFn(rowValue, columnValue).
 */
util.generateTable2d = (
    rowValues, rowLabelFn, columnValues, columnLabelFn, cellFn) => {
    var table = {};
    _.each(rowValues, rowValue => {
        var currentRow = table[rowLabelFn(rowValue)] = {};
        _.each(columnValues, columnValue => {
            currentRow[columnLabelFn(columnValue)] =
                cellFn(rowValue, columnValue);
        });
    });

    return table;
};

module.exports = util;
