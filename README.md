# sandromikautadze.github.io

Personal site, built with [Hugo](https://gohugo.io) and deployed to GitHub Pages by the workflow in `.github/workflows/hugo.yml` on every push to `master`.

## Run locally

Prerequisite: Hugo extended, 0.166 or newer (`brew install hugo`).

```
hugo server
```

Open http://localhost:1313. Drafts and future-dated posts are hidden unless you add `-D -F`.

## Editing

- `content/_index.md`: intro text on the home page
- `data/home.yaml`: news items (the first four show, the rest sit behind "See all")
- `data/things.yaml`: publications, hackathons, university projects (`flag: Thesis` adds the badge)
- `data/cv.yaml`: education and experience
- `data/medium.yaml`: Medium articles listed on the blog page
- `content/blog/<slug>.md`: a post. Frontmatter: `title`, `description`, `date`, `tags`, `math: true` when the post has LaTeX
- `hugo.toml`: contact links and site description

## Writing a post

Inline maths `$x$`, display maths `$$ ... $$`, footnotes `[^1]`, GFM tables, fenced code with a language tag for highlighting.

- Margin note: `{{< sidenote >}}text{{< /sidenote >}}`
- Interactive figure: export from Python with `fig.write_json("static/plots/name.json")`, then `{{< plotly src="/plots/name.json" >}}caption{{< /plotly >}}`

## LaTeX

Equations are rendered to HTML at build time by Hugo's bundled KaTeX, so the reader downloads no maths JavaScript. The stylesheet and fonts in `static/katex/` must match the KaTeX version Hugo bundles, otherwise sub- and superscripts misalign. Check with `hugo env` (look for `KaTeX`) and, after a Hugo upgrade that changes it, replace `static/katex/` with the matching release from https://cdn.jsdelivr.net/npm/katex@VERSION/dist/ (`katex.min.css` plus the `fonts/*.woff2` it references).

## Fonts

`static/fonts/` holds Latin subsets of Fraunces, Newsreader and JetBrains Mono with unused variable axes pinned. Regenerate only if you change typefaces.
