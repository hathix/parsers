let _ = require('lodash');
let Immutable = require('immutable');
let Baobab = require('baobab');

let util = require("./util");

/* LL(1) parser, from https://en.wikipedia.org/wiki/LL_parser
 */

util.addLodashUtilities();

/**
 * Returns the first set of a symbol.
 * For a terminal a, Fi(a) = [a].
 * For a nonterminal A, this recursively reduces A into terminals by following
 * production rules.
 */
function firstOfSymbol(symbol) {
    if (_.contains(NONTERMINALS, symbol)) {
        // find production rules that have this nonterminal on left side
        let validRules = _.filter(
            PRODUCTION_RULES, rule => rule.left === symbol);
        // find those rules' first symbols
        let firsts = _.map(validRules, firstOfProductionRule);
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
        let validRules = _.filter(PRODUCTION_RULES, rule =>
            _.includes(_.slice(rule.right, 0, rule.right.length - 1), symbol)
        );
        // find the symbols (terminal or nonterminal)
        // immediately to the right of the target symbol
        let unresolvedFollows = _.squish(_.map(validRules, rule => {
            let symbolIndices = _.indicesOf(rule.right, symbol);
            let rightIndices = _.map(symbolIndices, index => index + 1);
            return _.map(rightIndices, index => rule.right[index]);
        }));
        // recursively simplify the nonterminals in this follow set
        return _.squish(_.map(unresolvedFollows, followOfSymbol));
    } else {
        return [symbol];
    }
}


// define the language
const TERMINALS = [
    "a",
    "b",
    "c"
];

const NONTERMINALS = [
    "S",
    "A",
    "B"
];

// special symbols
const START = "S";
const END = "$";
const EMPTY = "0";

const SYMBOLS = _.union(TERMINALS, NONTERMINALS, [START, END, EMPTY]);

let PRODUCTION_RULES = [{
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
PRODUCTION_RULES = _.map(PRODUCTION_RULES, rule => {
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
    let validRules = _.filter(PRODUCTION_RULES, rule =>
        rule.left === nonterminal);
    let firsts = _.map(validRules, rule => rule.first);
    return _.squish(firsts);
}

// compute the first and follow sets of every nonterminal
let nonterminalData = _.map(NONTERMINALS, nonterminal => {
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
let parseTable = util.generateTable2d(
    nonterminalData,
    nonterminal => nonterminal.symbol,
    TERMINALS,
    _.identity,
    (nonterminal, terminal) => {
        // find all rules that have this nonterminal on the left...
        let nonterminalRules = _.filter(PRODUCTION_RULES, rule =>
            rule.left === nonterminal.symbol);
        // ...and the one that belongs in this cell. Again, there is either 0
        // or 1 rule that can be here.
        let validRules = _.filter(nonterminalRules, rule =>
            _.includes(rule.first, terminal) ||
            (_.includes(rule.first, EMPTY) &&
                _.includes(nonterminal.follow, terminal)));
        if (_.isEmpty(validRules)) {
            // there is no defined behavior for [A, a]
            return null;
        } else {
            // validRules should only have 1 element, so grab it; this element
            // is a production rule A => w
            // TODO: throw error if validRules has >1 elements
            return _.head(validRules);
        }
    }
);

// console.log(JSON.stringify(parseTable));

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
    let baseInput = Immutable.List(rawInputList).push(END);
    let baseStack = Immutable.Stack.of(START);
    // our output will be an abstract syntax tree, the root node of which is
    // the start symbol
    let baseTree = new Baobab(new util.TreeNode(START), {
        // Baobab options
        asynchronous: false,
        immutable: true
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
    let parseHelper = (input, stack, tree) => {
        // console.log(tree.get());
        if (stack.isEmpty()) {
            // done parsing
            // if the original input was valid, input should be no more than
            // the end symbol
            // since we're finished, return the finished tree
            return tree;
        } else {
            let topStackSymbol = stack.first();
            let topInputSymbol = input.first();

            if (topStackSymbol === topInputSymbol) {
                // if the stack and input symbols match, they can be removed;
                // the current node in the tree is a leaf, so move on to its
                // sibling
                return parseHelper(
                    input.shift(),
                    stack.pop(),
                    util.siblingNode(tree));
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
                    util.siblingNode(tree));
            } else {
                // look up the matching rule in the parse table and place the
                // right side thereof on the stack
                let rule = parseTable[topStackSymbol][topInputSymbol];
                return parseHelper(
                    input,
                    stack.pop().pushAll(rule.right),
                    // also add all the symbols on the right side to the tree
                    // and move into the leftmost new child (which happens by
                    // default when you drill down into a tree)
                    util.addChildren(tree, rule.right)
                        .select('children')
                        .down()
                        .leftmost());
            }
        }
    };

    return parseHelper(baseInput, baseStack, baseTree.root);

    // TODO: check that the input list contains only valid symbols
}

let ast = parse("aacbbcb".split(""));
console.log(JSON.stringify(ast));
