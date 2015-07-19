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

// Utility Baobab functions
/**
 * Utility constructor for creating tree nodes with specified values and
 * (by default) an empty list of children.
 */
util.TreeNode = class {
    constructor(value){
        this.value = value;
        this.children = [];
    }
};

/**
 * For TreeNodes in a Baobab tree.
 * Returns the node immediately to the right of the given node. But if the node
 * is already the rightmost child of its parent, returns the sibling of its
 * parent.
 */
util.siblingNode = (node) => {
    if (node.isRoot()) {
        // this node is the root of the tree; just return itself
        // TODO: throw error?
        return node;
    } else if (node === node.rightmost()) {
        // this node is already the rightmost; try going right on its parent
        // this requires two "up"'s -- one to get from the node to the list of
        // children of its parent, and another to get to the parent itself
        return util.siblingNode(node.up().up());
    } else {
        // standard case -- return the node to the right
        return node.right();
    }
};

/**
 * For TreeNodes in a Baobab tree.
 * Maps the given list of values to a list of new TreeNodes, attaches those
 * as new children of the given node, and returns the node. This mutates
 * the given node.
 */
util.addChildren = (node, valueList) => {
    var children = _.map(valueList, value => new util.TreeNode(value));
    node.select("children").push(children);
    return node;
};

module.exports = util;
