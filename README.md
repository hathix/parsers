# Context-Free Parsers

I'm interested in computational linguistics so here I'm trying my hand
at writing some parsers. This is purely as an exercise.

## Background (crash course on context-free grammar)

Programming languages, like human languages, are [context-free](https://en.wikipedia.org/wiki/Context-free_grammar)[1],
which in a nutshell means that programs (sentences) are composed of blocks (phrases),
which can in turn be composed of other blocks, and so on.

Formally speaking, you generate strings of terminal and nonterminal characters,
where every nonterminal character can be replaced with another string of
terminal and nonterminal characters.

Consider an example where we're trying to generate simple programs (or describe the structure thereof)
that can have an infinite number of nested `if`-statements. We specify that every `if`
*must* have an `else`, and (for simplicity's sake) we can only put `true`
or `false` in the `if`-statements' boolean checks.

For instance, we could have the program

```js
if (true) {
    if (false) {
        ;
    }
    else {
        ;
    }
}
else {
    ;
}
```

(The `;` is an empty statement, for simplicity's sake again.)

We can represent the structure of this program using these "production rules":

```js
Block => if (Expression) { Block } else { Block }
Block => ;
Expression => true
Expression => false
```

Whenever you see a symbol, you see where it appears on the left side
and replace it with whatever appears on the right side until you run out of
things that appears on the left side. (If something appears twice on the left
side, you can choose which rule to use.) Formally speaking, you replace
nonterminals (stuff that appears on the left) with strings of terminals
and nonterminals until you have a string of nothing but nonterminals.

So here's how we'd generate the above program. Let's say we start with just
a Block...

```js
Block
```
Now replace it with the "if rule" because empty programs are boring:

```js
if (Expression) {
    Block
}
else {
    Block
}
```

Replace the Expression with `true` (we could have done `false` too):

```js
if (true) {
    Block
}
else {
    Block
}
```

Replace the first Block with another `if` block, and the second with an empty block:

```js
if (true) {
    if (Expression) {
        Block
    }
    else {
        Block
    }
}
else {
    ;
}
```

From here, it's just recursively applying the same rules until we reach
the desired program.

**Footnotes**:

1. Human language is *at least* context free; in some circumstances it is too
complex to be modeled as a context-free language. But for simplicity we often
model it that way anyway.

## Running

In one Terminal tab:
```
gulp serve
```

In another, run this as needed:
```
node dist/app.js
```

## Todo's

* Use ES6 (nice to have, but not necessary & incurs additional overhead)
* Intelligently deduce list of terminals/nonterminals in language from production rules
* Move helper functions into own module
* Use more immutable data types instead of built-in JS ones

## References

* http://www.jflap.org/tutorial/grammar/LL/index.html
* https://en.wikipedia.org/wiki/LL_parser#Constructing_an_LL.28k.29_parsing_table
