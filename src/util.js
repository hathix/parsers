var _ = require('lodash');

var util = {};

// Utility Baobab functions
/**
 * Utility constructor for creating tree nodes with specified values and
 * (by default) an empty list of children.
 */
util.TreeNode = class {
    constructor(value) {
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
