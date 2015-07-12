var _ = require('lodash');

/* LL(1) parser, from https://en.wikipedia.org/wiki/LL_parser
 * We'll use the simple `(a+a)` language from that Wikipedia article.
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
})

/**
 * Given a symbol, finds one iteration toward its first set.
 * For nonterminals, this involves looking at all possible production rules
 * where it is on the left and returning the first symbol therein.
 */
function first(symbol) {
    if (_.contains(NONTERMINALS, symbol)) {
        // find production rules that have this nonterminal on left side
        var validRules = _.filter(PRODUCTION_RULES, function(rule) {
            return rule.left === symbol;
        });
        // find those rules' first symbols
        var firsts = _.map(validRules, function(rule) {
            return rule.right[0];
        });
        return _.union(firsts);
    } else if (_.contains(TERMINALS, symbol)) {
        // Fi(a) = a
        return [symbol];
    } else {
        // symbol = epsilon (empty string)
        return [symbol];
    }
}

/**
 * Given a symbol, finds one iteration toward its follow set.
 * For nonterminals, the involves looking at all possible production rules
 * where it is on the right and returning the first symbol immediately
 * thereafter, if one exists.
 */
function follow(symbol) {
    if (symbol === START) {
        // by definition, Fo(S) = epsilon
        return [EMPTY];
    } else if (_.contains(NONTERMINALS, symbol)) {
        // find production rules that have this nonterminal on right side
        // (but not at the very end)
        var validRules = _.filter(PRODUCTION_RULES, function(rule) {
            return _.includes(
                _.slice(rule.right, 0, rule.right.length - 1),
                symbol);
        });
        // find the symbols immediately to the right of that nonterminal
        var follows = _.map(validRules, function(rule) {
            var symbolIndices = _.indicesOf(rule.right, symbol);
            var rightIndices = _.map(symbolIndices, function(index) {
                return index + 1;
            });
            return _.map(rightIndices, function(index) {
                return rule.right[index];
            });
        });
        return _.squish(follows);
    } else if (_.contains(TERMINALS, symbol)) {
        // Fo(a) = a
        return [symbol];
    } else {
        // symbol = epsilon (empty string)
        return [symbol];
    }
}

/**
 * For a map of nonterminal => first set, returns true if no first set
 * contains any nonterminals.
 */
function hasNoNonterminals(firstSetMap) {
    return _.filter(firstSetMap, function(firstSet) {
        return _.intersection(NONTERMINALS, firstSet).length > 0;
    }).length === 0;
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

// find the first-set of every nonterminal, which is the set of all
// terminals that could appear as the first character in the expanded
// form of the terminal.
// we represent this as Fi(A) for nonterminals and initialize it as itself
// (i.e. Fi(A) = A); this represents the valid production rule A => A.
// for a terminal a, Fi(a) = a.
// e.g. if A => B | x, then Fi(A) = union(Fi(B), Fi(x)) = union(Fi(B), x)
var firstSetMap = {};
_.each(NONTERMINALS, function(nonterminal) {
    firstSetMap[nonterminal] = [nonterminal];
});

// find the follow-set of every nonterminal, which is the set of all
// terminals that could appear directly after the nonterminal.
// we represent this as Fo(A) for nonterminals and initialize it as itself
// (i.e. Fo(A) = A), which isn't actually correct but sets the stage for
// future function calls.
// for a terminal a, Fo(a) = a.
var followSetMap = {};
_.each(NONTERMINALS, function(nonterminal) {
    followSetMap[nonterminal] = [nonterminal];
});

// repeatedly simplify the first sets until no first set has any
// nonterminals left
while (!hasNoNonterminals(firstSetMap)) {
    _.each(NONTERMINALS, function(nonterminal) {
        firstSetMap[nonterminal] = _.squish(
            _.map(firstSetMap[nonterminal], first));
    });
}
// do the same with the follow set, with the exception that the start symbol
// always has a follow set of the end symbol
while (!hasNoNonterminals(followSetMap)) {
    _.each(NONTERMINALS, function(nonterminal) {
        if (nonterminal === START) {
            followSetMap[nonterminal] = [END];
        } else {
            followSetMap[nonterminal] = _.squish(
                _.map(followSetMap[nonterminal], follow));
        }
    });
}

console.log(firstSetMap);
console.log(followSetMap);
