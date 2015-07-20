let _ = require('lodash');
let Immutable = require('immutable');
let Baobab = require('baobab');

let util = require("./util");

/**
 * A rule for context-free grammars that specifies what string of nonterminals
 * and terminals can replace a nonterminal wherever the nonterminal appears.
 * e.g., for "A => aB", wherever "A" appears it can be replaced with "aB".
 *
 */
class ProductionRule {
    /**
     * Generates a production rule with the given nonterminal (String) on the
     * arrow's left side and the given string of nonterminals and terminals
     * (String array) on the right side.
     * This is represented as A => w.
     */
    constructor(left, right) {
        this.left = left;
        this.right = Immutable.List(right);
    }

    toString() {
        return this.left + "=>" + this.right.join(" ");
    }
}

/**
 * An LL(1) parser, a top-down parser for a subset of context-free languages.
 * It uses a queue of input characters, a stack of active symbols, and a
 * production table that determines what action to take given a certain input
 * and top stack symbol, ultimately producing an abstract syntax tree out of
 * a string of terminal symbols.
 * See https://en.wikipedia.org/wiki/LL_parser.
 */
class LL1Parser {
    /**
     * Generates a parser that operates on the given list of ProductionRules.
     * It infers the language from the production rules and prepares it for
     * use with parse() on a string of nonterminals.
     * At least one production rule MUST have the string "S" on the left
     * -- that's the starting rule.
     * TODO: refactor so this is more obvious (like have the first rule be
     * the start rule)
     */
    constructor(rawProductionRules) {
        let productionRules = Immutable.Set(rawProductionRules);
        // build the language
        // nonterminals are all symbols that appear on the left side
        this.NONTERMINALS = productionRules.map(rule => rule.left);

        // terminals are all symbols that appear on the right side, except
        // nonterminals and the empty string
        this.TERMINALS = productionRules
            .map(rule => rule.right)
            .flatten()
            .filterNot(symbol => this.NONTERMINALS.includes(symbol))
            .filterNot(symbol => symbol === this.EMPTY);

        // find the first set of every production rule, which is the set of all
        // terminals that could appear as the first character of that
        // production rule.
        // for a production rule w, this is Fi(w).
        // e.g. if A => Bc and B => d | e, then Fi(Bc) = union(d, e)
        this.PRODUCTION_RULES = productionRules.map(rule => {
            let newRule = _.clone(rule);
            newRule.first = this.firstOfProductionRule(rule);
            return newRule;
        });

        // build parsing table given first and follow sets
        // for table T, T[A,a] contains the rule A => w iff
        //  - a is in Fi(w), or
        //  - epsilon is in Fi(w) and a is in Fo(A)
        // with an LL(1) parser, T[A,a] is guaranteed to contain at most 1 rule
        // here, T[A,a] contains either a rule or undefined
        // this will be a doubly-nested Map (a Map where the values are
        // themselves Maps.) you would access a rule A => w with
        // map.get(A).get(a) per the rules above.
        this.parseTable = this.NONTERMINALS
            .toMap()
            .map(nonterminal =>
                // the value of this first map should be a map that maps
                // a symbol to a particular production rule
                this.TERMINALS
                    .toMap()
                    .map(terminal =>
                        // now that we have the terminal and nonterminal
                        // (the "row" and "column" values for this "table"),
                        // find the appropriate production rule; there should
                        // be either 0 or 1 matching rules by definition of an
                        // LL(1) parser
                        // per the guidelines above, the appropriate rule
                        // must have the nonterminal on the left
                        // and fulfill one of the specified critera
                        this.PRODUCTION_RULES
                            .filter(rule => rule.left === nonterminal)
                            .filter(rule =>
                                rule.first.includes(terminal) ||
                                    (rule.first.includes(this.EMPTY) &&
                                        this.followOfSymbol(nonterminal)
                                            .includes(terminal)))
                            .first()
                    )
            );
    }

    // Constants
    // TODO: extract as global constants so clients can use them too
    get START() {
        return "S";
    }
    get END() {
        return "$";
    }
    get EMPTY() {
        return "0";
    }
    // TODO: extract this into a parent Parser class because all parsers
    // will likely reuse this
    get SYMBOLS() {
        return Immutable.Set.of(
            this.TERMINALS,
            this.NONTERMINALS,
            [this.START, this.END, this.EMPTY]
        );
    }

    /**
     * Returns the first set of a symbol.
     * For a terminal a, Fi(a) = [a].
     * For a nonterminal A, this recursively reduces A into terminals by
     * following production rules.
     */
    firstOfSymbol(symbol) {
        if (this.NONTERMINALS.contains(symbol)) {
            // find production rules that have this nonterminal on left side
            // and grab their first symbols
            return this.PRODUCTION_RULES
                .filter(rule => rule.left === symbol)
                .map(rule => this.firstOfProductionRule(rule))
                .flatten()
        } else {
            // for a terminal a, Fi(a) = [a]
            return Immutable.Set.of(symbol);
        }
    }

    /**
     * Returns the first terminal symbol on the right side of a production rule.
     * For a rule A => w, this returns Fi(w).
     */
    firstOfProductionRule(rule) {
        return this.firstOfSymbol(rule.right.first());
    }

    /**
     * Returns the follow set of a symbol.
     * For a terminal a, Fo(a) = [a].
     * For a nonterminal A, this recursively reduces A into terminals by
     * following production rules.
     */
    followOfSymbol(symbol) {
        if (symbol === this.START) {
            // by definition, Fo(S) = $, where S = start symbol and
            // $ = end symbol
            return Immutable.Set.of(this.END);
        } else if (this.NONTERMINALS.includes(symbol)) {
            // find production rules that have this nonterminal on right side
            // (but not at the very end)
            let validRules = this.PRODUCTION_RULES.filter(rule =>
                rule.right
                    .butLast()
                    .includes(symbol)
            );
            // find the symbols (terminal or nonterminal)
            // immediately to the right of the target symbol
            let unresolvedFollows = validRules
                .map(rule => {
                    // find indices where target symbol is, except indices
                    // at the end of the list, because we want to find symbols
                    // to the right of these indices
                    let symbolIndices = Immutable.Range(0, rule.right.size)
                        .butLast()
                        .filter(index => rule.right.get(index) === symbol);
                    // find indices immediately to the right
                    let rightIndices = symbolIndices.map(index => index + 1);
                    // look up the symbols at those indices
                    return rightIndices.map(index => rule.right.get(index));
               })
               .flatten();
            // recursively simplify the nonterminals in this follow set
            return unresolvedFollows
                .map(symbol => this.followOfSymbol(symbol))
                .flatten();
        } else {
            return Immutable.Set.of(symbol);
        }
    }

    /*
     * From the production rules find the first-set of every nonterminal,
     * which is the union of all the first sets of all the production rules
     * where the nonterminal appears on the left.
     */
    firstOfNonterminal(nonterminal) {
        return this.PRODUCTION_RULES
            .filter(rule => rule.left === nonterminal)
            .map(rule => rule.first)
            .flatten();
    }

    /**
     * Given a list of terminal symbols, parses it into the abstract syntax
     * tree that generated this list. The list should have the first symbol to
     * be parsed at the front.
     */
    parse(rawInputList) {
        // TODO: check that the input list contains only valid symbols
        // we have a list of input symbols (must be terminated with the end
        // character for our parsing to work) and a stack representing the
        // current state of the AST, which naturally starts out with the start
        // symbol (which represents the full sentence and the head of the AST)
        let baseInput = Immutable.List(rawInputList).push(this.END);
        let baseStack = Immutable.Stack.of(this.START);
        // our output will be an abstract syntax tree, the root node of which
        // is the start symbol
        let baseTree = new Baobab(new util.TreeNode(this.START), {
            // Baobab options
            // baobab publishes updates async by default; using promises or
            // callbacks would make the code really messy so just disable that
            asynchronous: false,
            // there's no difference by including immutability but it fits
            // the theme here
            immutable: true
        });

        /**
         * Parses the given input (Immutable.List) using the given stack
         * (Immutable.Stack) and uses this to build up the given abstract
         * syntax tree (Baobab), returning null if the given input symbols
         * cannot be generated by this parser's grammar.
         * The given tree should be a Baobab cursor; if you have a Baobab tree
         * just access its "root" field.
         * The root of the given tree should have the same value
         * as the element at the top of the stack (i.e. the given tree gets
         * built recursively.
         */
        let parseHelper = (input, stack, tree) => {
            // console.log(tree.get());
            if (stack.isEmpty()) {
                // done parsing
                // if the original input was valid, input should be no more
                // than the end symbol
                if (input.equals(Immutable.List.of(this.END))) {
                    return tree;
                } else {
                    return null;
                }
            } else {
                let topStackSymbol = stack.first();
                let topInputSymbol = input.first();

                if (topStackSymbol === topInputSymbol) {
                    // if the stack and input symbols match, they can be
                    // removed; the current node in the tree is a leaf, so
                    // move on to its sibling
                    return parseHelper(
                        input.shift(),
                        stack.pop(),
                        util.siblingNode(tree));
                } else if (topStackSymbol === this.EMPTY) {
                    // an empty symbol can simply be removed from the stack
                    // because it is, well, empty
                    // the empty symbol is a leaf, so move on to its sibling
                    // -- which will be the sibling of its parent because the
                    // empty sibling is always the only child of its parent
                    // and, therefore, the rightmost sibling thereof
                    return parseHelper(
                        input,
                        stack.pop(),
                        util.siblingNode(tree));
                } else {
                    // look up the matching rule in the parse table and place
                    // the right side thereof on the stack
                    let rule = this.parseTable
                        .get(topStackSymbol)
                        .get(topInputSymbol);
                    return parseHelper(
                        input,
                        stack.pop().pushAll(rule.right),
                        // also add all the symbols on the right side to the
                        // tree and move into the leftmost new child (which
                        // happens by default when you drill down into a tree)
                        util.addChildren(tree, rule.right.toArray())
                            .select('children')
                            .down()
                            .leftmost());
                }
            }
        };
        return parseHelper(baseInput, baseStack, baseTree.root);
    }
}

let parser = new LL1Parser([
    new ProductionRule("S", ["a", "A", "B", "b"]),
    new ProductionRule("A", ["a", "A", "c"]),
    new ProductionRule("A", ["0"]),
    new ProductionRule("B", ["b", "B"]),
    new ProductionRule("B", ["c"])
]);
let ast = parser.parse("aacbbcb".split(""));
console.log(JSON.stringify(ast));
