var _ = require('lodash');
var Immutable = require('immutable');
var Baobab = require('baobab');

/* LL(1) parser, from https://en.wikipedia.org/wiki/LL_parser
 */

// utility functions

_.mixin({
    // unions all the component arrays of a list.
    // _.squish([[1,2],[2,3]]) == [1,2,3]
    'squish': function(list) {
        return _.reduce(list, function(a, b) {
            return _.union(a, b);
        }, []);
    },

    // returns all indices where an element occurs in a list
    // _.indicesOf([1,2,3,2], 2) == [1, 3]
    // _.indicesOf([1,2,3,2], 4) == []
    'indicesOf': function(list, needle) {
        return _.reduce(list, function(memo, value, index) {
            if (_.isEqual(value, needle)) {
                memo.push(index);
            }
            return memo;
        }, []);
    }
});

/**
 * Generates a 2D table using the Cartesian cross product of rowValues and
 * columnValues. For a given (rowValue, columnValue) pair, the cell
 * [rowLabelFn(rowValue), columnLabelFn(columnValue)] will have the value
 * cellFn(rowValue, columnValue).
 */
function generateTable2d(rowValues, rowLabelFn, columnValues,
    columnLabelFn, cellFn) {
    var table = {};
    _.each(rowValues, function(rowValue) {
        var currentRow = table[rowLabelFn(rowValue)] = {};
        _.each(columnValues, function(columnValue) {
            currentRow[columnLabelFn(columnValue)] =
                cellFn(rowValue, columnValue);
        });
    });

    return table;
}

/**
 * Returns the first set of a symbol.
 * For a terminal a, Fi(a) = [a].
 * For a nonterminal A, this recursively reduces A into terminals by following
 * production rules.
 */
function firstOfSymbol(symbol) {
    if (_.contains(NONTERMINALS, symbol)) {
        // find production rules that have this nonterminal on left side
        var validRules = _.filter(PRODUCTION_RULES, function(rule) {
            return rule.left === symbol;
        });
        // find those rules' first symbols
        var firsts = _.map(validRules, function(rule) {
            return firstOfProductionRule(rule);
        });
        return _.squish(firsts);
    } else {
        return [symbol];
    }
}

/**
 * Returns the first terminal symbol on the right side of a production rule.
 * For a rule A => w, this returns Fi(w).
 */
function firstOfProductionRule(rule) {
    return firstOfSymbol(_.head(rule.right));
}

/**
 * Returns the follow set of a symbol.
 * For a terminal a, Fo(a) = [a].
 * For a nonterminal A, this recursively reduces A into terminals by following
 * production rules.
 */
function followOfSymbol(symbol) {
    if (symbol === START) {
        // by definition, Fo(S) = $, where S = start symbol and $ = end symbol
        return [END];
    } else if (_.contains(NONTERMINALS, symbol)) {
        // find production rules that have this nonterminal on right side
        // (but not at the very end)
        var validRules = _.filter(PRODUCTION_RULES, function(rule) {
            return _.includes(
                _.slice(rule.right, 0, rule.right.length - 1),
                symbol);
        });
        // find the symbols (terminal or nonterminal)
        // immediately to the right of the target symbol
        var unresolvedFollows = _.squish(_.map(validRules, function(rule) {
            var symbolIndices = _.indicesOf(rule.right, symbol);
            var rightIndices = _.map(symbolIndices, function(index) {
                return index + 1;
            });
            return _.map(rightIndices, function(index) {
                return rule.right[index];
            });
        }));
        // recursively simplify the nonterminals in this follow set
        return _.squish(_.map(unresolvedFollows, followOfSymbol));
    } else {
        return [symbol];
    }
}


// define the language
var TERMINALS = [
    "a",
    "b",
    "c"
];

var NONTERMINALS = [
    "S",
    "A",
    "B"
];

// special symbols
var START = "S";
var END = "$";
var EMPTY = "0";

var SYMBOLS = _.union(TERMINALS, NONTERMINALS, [START, END, EMPTY]);

var PRODUCTION_RULES = [{
    left: "S",
    right: ["a", "A", "B", "b"]
}, {
    left: "A",
    right: ["a", "A", "c"]
}, {
    left: "A",
    right: ["0"]
}, {
    left: "B",
    right: ["b", "B"]
}, {
    left: "B",
    right: ["c"]
}];


// generate parsing table

// find the first set of every production rule, which is the set of all
// terminals that could appear as the first character of that production rule.
// for a production rule w, this is Fi(w).
// e.g. if A => Bc and B => d | e, then Fi(Bc) = union(d, e)
PRODUCTION_RULES = _.map(PRODUCTION_RULES, function(rule) {
    return {
        left: rule.left,
        right: rule.right,
        first: firstOfProductionRule(rule)
    };
});

/*
 * From the production rules find the first-set of every nonterminal, which is
 * the union of all the first sets of all the production rules where the
 * nonterminal appears on the left.
 */
function firstOfNonterminal(nonterminal) {
    var validRules = _.filter(PRODUCTION_RULES, function(rule) {
        return rule.left === nonterminal;
    });
    var firsts = _.map(validRules, function(rule) {
        return rule.first;
    });
    return _.squish(firsts);
}

// compute the first and follow sets of every nonterminal
var nonterminalData = _.map(NONTERMINALS, function(nonterminal) {
    return {
        symbol: nonterminal,
        first: firstOfNonterminal(nonterminal),
        follow: followOfSymbol(nonterminal)
    };
});


// build parsing table given first and follow sets
// for table T, T[A,a] contains the rule A => w iff
//  - a is in Fi(w), or
//  - epsilon is in Fi(w) and a is in Fo(A)
// with an LL(1) parser, T[A,a] is guaranteed to contain at most 1 rule
// here, T[A,a] contains either a rule or null
var parseTable = generateTable2d(nonterminalData, function(nonterminal) {
    return nonterminal.symbol;
}, TERMINALS, function(terminal) {
    return terminal;
}, function(nonterminal, terminal) {
    // find all rules that have this nonterminal on the left...
    var nonterminalRules = _.filter(PRODUCTION_RULES, function(rule) {
        return rule.left === nonterminal.symbol;
    });
    // ...and the one that belongs in this cell. Again, there is either 0
    // or 1 rule that can be here.
    var validRules = _.filter(nonterminalRules, function(rule) {
        return _.includes(rule.first, terminal) ||
            (_.includes(rule.first, EMPTY) &&
                _.includes(nonterminal.follow, terminal));
    });
    if (_.isEmpty(validRules)) {
        // there is no defined behavior for [A, a]
        return null;
    } else {
        // validRules should only have 1 element, so grab it; this element
        // is a production rule A => w
        // TODO: throw error if validRules has >1 elements
        return _.head(validRules);
    }
});

// console.log(JSON.stringify(parseTable));

/**
 * Utility constructor for creating tree nodes with specified values and
 * (by default) an empty list of children.
 */
function TreeNode(value) {
    this.value = value;
    this.children = [];
}

// Utility Baobab functions
/**
 * For TreeNodes in a Baobab tree.
 * Returns the node immediately to the right of the given node. But if the node
 * is already the rightmost child of its parent, returns the sibling of its
 * parent.
 */
function siblingNode(node) {
    if (node.isRoot()) {
        // this node is the root of the tree; just return itself
        // TODO: throw error?
        return node;
    } else if (node === node.rightmost()) {
        // this node is already the rightmost; try going right on its parent
        // this requires two "up"'s -- one to get from the node to the list of
        // children of its parent, and another to get to the parent itself
        return siblingNode(node.up().up());
    } else {
        // standard case -- return the node to the right
        return node.right();
    }
}

/**
 * For TreeNodes in a Baobab tree.
 * Maps the given list of values to a list of new TreeNodes, attaches those
 * as new children of the given node, and returns the node. This mutates
 * the given node.
 */
function addChildren(node, valueList) {
    var children = _.map(valueList, function(value) {
        return new TreeNode(value);
    });
    node.select("children").push(children);
    return node;
}

/**
 * Given a list of terminal symbols, parses it into the abstract syntax tree
 * that generated this list. The list should have the first symbol to be
 * parsed at the front.
 */
function parse(rawInputList) {
    // we have a list of input symbols (must be terminated with the end
    // character for our parsing to work) and a stack representing the current
    // state of the AST, which naturally starts out with the start symbol
    // (which represents the full sentence and the head of the AST)
    var baseInput = Immutable.List(rawInputList).push(END);
    var baseStack = Immutable.Stack.of(START);
    // our output will be an abstract syntax tree, the root node of which is
    // the start symbol
    var baseTree = new Baobab(new TreeNode(START), {
        // Baobab options
        asynchronous: false,
        // immutable: true
    });

    /**
     * Parses the given input (Immutable.List) using the given stack
     * (Immutable.Stack) and uses this to build up the given abstract syntax
     * tree (Baobab).
     * The given tree should be a Baobab cursor; if you have a Baobab tree
     * just access its "root" field.
     * The root of the given tree should have the same value
     * as the element at the top of the stack (i.e. the given tree gets built
     * recursively.
     */
    var parseHelper = function(input, stack, tree) {
        // console.log(tree.get());
        if (stack.isEmpty()) {
            // done parsing
            // if the original input was valid, input should be no more than
            // the end symbol
            // since we're finished, return the finished tree
            return tree;
        } else {
            var topStackSymbol = stack.first();
            var topInputSymbol = input.first();

            if (topStackSymbol === topInputSymbol) {
                // if the stack and input symbols match, they can be removed;
                // the current node in the tree is a leaf, so move on to its
                // sibling
                return parseHelper(
                    input.shift(),
                    stack.pop(),
                    siblingNode(tree));
            } else if (topStackSymbol === EMPTY) {
                // an empty symbol can simply be removed from the stack
                // because it is, well, empty
                // the empty symbol is a leaf, so move on to its sibling
                // -- which will be the sibling of its parent because the
                // empty sibling is always the only child of its parent and,
                // therefore, the rightmost sibling thereof
                return parseHelper(
                    input,
                    stack.pop(),
                    siblingNode(tree));
            } else {
                // look up the matching rule in the parse table and place the
                // right side thereof on the stack
                var rule = parseTable[topStackSymbol][topInputSymbol];
                return parseHelper(
                    input,
                    stack.pop().pushAll(rule.right),
                    // also add all the symbols on the right side to the tree
                    // and move into the leftmost new child (which happens by
                    // default when you drill down into a tree)
                    addChildren(tree, rule.right)
                        .select('children')
                        .down()
                        .leftmost());
            }
        }
    };

    return parseHelper(baseInput, baseStack, baseTree.root);

    // TODO: check that the input list contains only valid symbols
}

var ast = parse("aacbbcb".split(""));
console.log(JSON.stringify(ast));
