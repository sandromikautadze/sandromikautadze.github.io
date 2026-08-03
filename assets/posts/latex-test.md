# LaTeX Rendering Test

A tiny sample post to confirm that inline and display math render correctly through MathJax.

Inline math should sit within a sentence, like the softmax function $\sigma(z)_i = \dfrac{e^{z_i}}{\sum_{j=1}^{K} e^{z_j}}$, without breaking the line.

Display math should render as its own centered block, like the contrastive loss below:

$$
\mathcal{L} = -\frac{1}{N} \sum_{i=1}^{N} \log \frac{\exp(\text{sim}(z_i, z_i^+) / \tau)}{\sum_{j=1}^{N} \exp(\text{sim}(z_i, z_j) / \tau)}
$$

If both of the formulas above are typeset properly instead of showing raw LaTeX source, MathJax is working as expected.
