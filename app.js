var _ = require('lodash');

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
var firstAndFollowSets = _.map(NONTERMINALS, function(nonterminal) {
    return {
        symbol: nonterminal,
        first: firstOfNonterminal(nonterminal),
        follow: followOfSymbol(nonterminal)
    };
});
