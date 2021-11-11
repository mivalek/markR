// add bootstrap table styles to pandoc tables
function bootstrapStylePandocTables() {
  $("tr.odd").parent("tbody").parent("table").addClass("table table-condensed");
}
$(document).ready(function () {
  bootstrapStylePandocTables();
});

$(document).ready(function () {
  $(".tabset-dropdown > .nav-tabs > li").click(function () {
    $(this).parent().toggleClass("nav-tabs-open");
  });
});

(function () {
  var script = document.createElement("script");
  script.type = "text/javascript";
  script.src =
    "https://mathjax.rstudio.com/latest/MathJax.js?config=TeX-AMS-MML_HTMLorMML";
  document.getElementsByTagName("head")[0].appendChild(script);
})();
