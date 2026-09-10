---
title: What a Linear Probe Actually Measures
description: A worked example of probing a small vision-language model, with the maths spelled out and the two ways the result can fool you.
date: 2026-09-08
tags: [interpretability, vlm]
math: true
draft: false
---

This is a placeholder post that exercises every feature the blog needs: display and inline maths, a figure with a caption, a table, code, a footnote and a margin note. The text is real enough to read but the numbers are invented.

## Setup

Take a frozen vision-language model and a dataset of $N$ image-question pairs with binary labels $y_i \in \{0, 1\}$. At layer $\ell$ we read the residual stream at the last token, $h_i^{(\ell)} \in \mathbb{R}^d$, and fit a logistic probe

$$
\begin{aligned}
p(y_i = 1 \mid h_i) &= \sigma\!\left(w^\top h_i^{(\ell)} + b\right), \\
\hat{w}, \hat{b} &= \arg\min_{w, b} \; \frac{1}{N}\sum_{i=1}^{N} \mathcal{L}\big(y_i, \sigma(w^\top h_i + b)\big) + \lambda \lVert w \rVert_2^2 .
\end{aligned}
$$

The probe accuracy on held-out data is what people report.{{< sidenote >}}Usually with a 50/50 class balance, so 50% is chance. Check this before being impressed by 71%.{{< /sidenote >}} The claim it licenses is weaker than it looks: linear decodability says the information is *present*, not that the model *uses* it.[^1]

## Two ways to be fooled

### Decodable but unused

If $\hat{w}$ finds a direction correlated with the label through some spurious feature, the probe is fine and the model is not. A quick check is to ablate along $\hat{w}$,

$$
\tilde{h}_i = h_i - \frac{\hat{w}^\top h_i}{\lVert \hat{w} \rVert^2}\,\hat{w},
$$

and see whether the model's own answer changes. If it does not, the probe is reading something the model ignores.

### Used but not linearly decodable

The converse also happens. Below is an invented example over layers.

| Layer | Probe acc. | Ablation Δ acc. |
|------:|-----------:|----------------:|
| 8     | 0.62       | −0.01           |
| 16    | 0.71       | −0.02           |
| 24    | 0.88       | −0.19           |
| 32    | 0.90       | −0.04           |

Layer 24 is where the direction is both decodable and load-bearing. Layer 32 is decodable and inert, which is the first failure mode.

{{< plotly src="/plots/probe-layers.json" height="380" >}}Probe accuracy and the drop in model accuracy after ablating the probe direction, per layer. Hover for values, drag the range slider to zoom, click a legend entry to hide a series. Invented data.{{< /plotly >}}

## Code

The whole thing is thirty lines.

```python
import torch

def fit_probe(H, y, l2=1e-2, steps=500, lr=1e-2):
    """Logistic probe on residual activations H (N, d) with labels y (N,)."""
    w = torch.zeros(H.shape[1], requires_grad=True)
    b = torch.zeros(1, requires_grad=True)
    opt = torch.optim.Adam([w, b], lr=lr)
    for _ in range(steps):
        logits = H @ w + b
        loss = torch.nn.functional.binary_cross_entropy_with_logits(logits, y) + l2 * (w @ w)
        opt.zero_grad(); loss.backward(); opt.step()
    return w.detach(), b.detach()

def ablate(H, w):
    """Project out the probe direction from every activation."""
    return H - (H @ w)[:, None] * w[None, :] / (w @ w)
```

## What to report

Report probe accuracy and the ablation effect together, per layer, or report neither.

[^1]: The distinction is made carefully in Belinkov, *Probing Classifiers: Promises, Shortcomings, and Advances* [arXiv:2102.12452](https://arxiv.org/abs/2102.12452).
