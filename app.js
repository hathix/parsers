var _ = require('lodash');

/* LL(1) parser, from https://en.wikipedia.org/wiki/LL_parser
 * We'll use the simple `(a+a)` language from that Wikipedia article.
 */

// utility functions

// unions all the component arrays of a list.
// _.squish([[1,2],[2,3]]) == [1,2,3]
_.mixin({'squish': function(list) {
    return _.reduce(list, function(a, b) {
        return _.union(a, b);
    }, []);
}});


// define the language
var TERMINALS = [
    "(",
    ")",
    "a",
    "+",
    "$"
];

var NONTERMINALS = [
    "S",
    "F"
];

var SYMBOLS = _.union(TERMINALS, NONTERMINALS);

var PRODUCTION_RULES = [{
    left: "S",
    right: ["F"]
}, {
    left: "S",
    right: ["(", "S", "+", "F", ")"]
}, {
    left: "F",
    right: ["a"]
}];

// generate parsing table
// find the first-set of every nonterminal, which is the set of all
// terminals that could appear as the first character in the expanded
// form of the terminal.
// we represent this as Fi(A) for nonterminals.
// for a terminal a, Fi(a) = a.
// e.g. if A => B | x, then Fi(A) = union(Fi(B), Fi(x)) = union(Fi(B), x)
var firstSetMap = {};
_.each(NONTERMINALS, function(nonterminal) {
    firstSetMap[nonterminal] = [nonterminal];
});

/**
 * Given a symbol, finds its first set (to one iteration.)
 * For nonterminals, this involves looking at all possible production rules
 * that include it and returning the first symbol therein.
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
 * For a map of nonterminal => first set, returns true if no first set
 * contains any nonterminals.
 */
function hasNoNonterminals(firstSetMap) {
    return _.filter(firstSetMap, function(firstSet) {
        return _.intersection(NONTERMINALS, firstSet).length > 0;
    }).length === 0;
}

// repeatedly simplify the first sets until no first set has any
// nonterminals left
while (!hasNoNonterminals(firstSetMap)) {
    _.each(NONTERMINALS, function(nonterminal) {
        firstSetMap[nonterminal] = _.squish(_.map(firstSetMap[nonterminal], first));
    });
}
console.log(firstSetMap);
