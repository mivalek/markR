// Insert this line after script imports
if (window.module) module = window.module;

let filePath,
    ctrlPressed = false,
    shiftPressed = false,
    unsaved = false,
    nCommentsOld = 0,
    nCommentsNew = 0,
    commentContentsOld = [],
    commentContentsNew = [];

const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
});

// check for changes in comments
// create an observer instance
const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
        console.log(mutation.type);
    });
});

// configuration of the observer:
const config = {
    attributes: false,
    childList: false,
    characterData: true,
    characterDataOldValue: true,
};

function positionComments() {
    $("[order]").each(function () {
        const anchor = $(this);
        let position = anchor.offset().top - 16;
        const commId = anchor.attr("href");
        const order = parseInt(anchor.attr("order"));
        if (order) {
            const prevCommId = $(`[order=${order - 1}]`).attr("href");
            const prevComm = $(prevCommId);
            const thisCommOffset =
                prevComm.offset().top + prevComm.outerHeight(true) + 5;
            position = Math.max(thisCommOffset, position);
        }
        $(commId).css("top", position + "px");
    });
}

// receive opened HTML file string
window.electron.receive("htmlString:send", (data) => {
    const parser = new DOMParser();
    filePath = data.path;
    const doc = parser.parseFromString(data.content, "text/html");

    if (doc.querySelector(".marked_container")) {
        document.querySelector(".marked_container").innerHTML =
            doc.querySelector(".marked_container").innerHTML;
    } else if (doc.querySelector(".toc-content")) {
        document.querySelector(".main-text").innerHTML =
            doc.querySelector(".toc-content").innerHTML;
        console.log("has floating TOC");
    } else if (doc.querySelector(".container-fluid")) {
        document.querySelector(".main-text").innerHTML =
            doc.querySelector(".container-fluid").innerHTML;
        console.log("doesn't have floating TOC");
    } else {
        throw new Error("Unknown HTML output format");
    }

    const sections = document.querySelectorAll(".section");
    if (sections.length) {
        let mainText = [];
        sections.forEach((s) => mainText.push(s.innerHTML));
        document.querySelector(".main-text").innerHTML = mainText;
    }

    // add bootstrap table styles to pandoc tables
    function bootstrapStylePandocTables() {
        $("tr.odd")
            .parent("tbody")
            .parent("table")
            .addClass("table table-condensed");
    }
    $(document).ready(function () {
        bootstrapStylePandocTables();
    });

    $(document).ready(function () {
        $(".tabset-dropdown > .nav-tabs > li").click(function () {
            $(this).parent().toggleClass("nav-tabs-open");
        });
        MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
    });

    $(document).ready(function () {
        positionComments();
        // $(".comment").each(() => observer.observe(this, config));
    });

    $(window).resize(function () {
        positionComments();
    });

    (function () {
        var script = document.createElement("script");
        script.type = "text/javascript";
        script.src =
            "https://mathjax.rstudio.com/latest/MathJax.js?config=TeX-AMS-MML_HTMLorMML";
        document.getElementsByTagName("head")[0].appendChild(script);
    })();

    document.querySelectorAll(".comment").forEach((comment) => {
        comment.addEventListener("focusout", function () {
            renderComment(this);
        });
        comment.parentNode.addEventListener("click", function () {
            editComment(this);
        });
        comment.parentNode.addEventListener("mouseover", hlighlightComment);
        comment.parentNode.addEventListener("mouseout", unhighlightComment);
        const commentInput = comment.querySelector(".comment-input");
        commentInput.value = turndownService.turndown(
            comment.querySelector(".comment-display")
        );
        commentInput.addEventListener("input", resizeCommentInput);
    });

    document.querySelectorAll("[hl-id").forEach((hl) => {
        hl.addEventListener("mouseenter", hlighlightComment);
        hl.addEventListener("mouseout", unhighlightComment);
    });

    getComments();
    nCommentsOld = nCommentsNew;
    commentContentsOld = commentContentsNew;
});

window.electron.receive("tab:close", (tabID) => {
    console.log(tabID);
    console.log("tab close event received");
    sendFileToWriter();

    console.log("file sent");
    window.electron.sendToHost("file:did-save", tabID);
});

window.electron.receive("file:saving", (last) => {
    const lastFile = last === "true";
    saveFile(lastFile);
});

// from https://stackoverflow.com/questions/304837/javascript-user-selection-highlighting
function getSafeRanges(dangerous) {
    var a = dangerous.commonAncestorContainer;
    // Starts -- Work inward from the start, selecting the largest safe range
    var s = new Array(0),
        rs = new Array(0);
    if (dangerous.startContainer != a)
        for (var i = dangerous.startContainer; i != a; i = i.parentNode)
            s.push(i);
    if (0 < s.length)
        for (var i = 0; i < s.length; i++) {
            var xs = document.createRange();
            if (i) {
                xs.setStartAfter(s[i - 1]);
                xs.setEndAfter(s[i].lastChild);
            } else {
                xs.setStart(s[i], dangerous.startOffset);
                xs.setEndAfter(
                    s[i].nodeType == Node.TEXT_NODE ? s[i] : s[i].lastChild
                );
            }
            rs.push(xs);
        }

    // Ends -- basically the same code reversed
    var e = new Array(0),
        re = new Array(0);
    if (dangerous.endContainer != a)
        for (var i = dangerous.endContainer; i != a; i = i.parentNode)
            e.push(i);
    if (0 < e.length)
        for (var i = 0; i < e.length; i++) {
            var xe = document.createRange();
            if (i) {
                xe.setStartBefore(e[i].firstChild);
                xe.setEndBefore(e[i - 1]);
            } else {
                xe.setStartBefore(
                    e[i].nodeType == Node.TEXT_NODE ? e[i] : e[i].firstChild
                );
                xe.setEnd(e[i], dangerous.endOffset);
            }
            re.unshift(xe);
        }

    // Middle -- the uncaptured middle
    if (0 < s.length && 0 < e.length) {
        var xm = document.createRange();
        xm.setStartAfter(s[s.length - 1]);
        xm.setEndBefore(e[e.length - 1]);
    } else {
        return [dangerous];
    }

    // Concat
    rs.push(xm);
    response = rs.concat(re);

    // Send to Console
    return response;
}

function highlightSelection() {
    const userSelection = window.getSelection().getRangeAt(0);
    const safeRanges = getSafeRanges(userSelection);
    const hlId = makeId();
    for (let i = 0; i < safeRanges.length; i++) {
        highlightRange(safeRanges, i, hlId);
    }
}

function highlightRange(range, iter, id) {
    const newNode = document.createElement("span");
    newNode.setAttribute("hl-id", id); // give all highlight divs a hl-id attribute
    newNode.classList.add("highlight", "latest");
    range[iter].surroundContents(newNode);
    if (iter === range.length - 1) {
        const newAnchor = document.createElement("a");
        newAnchor.id = id; // id equal to hl-id of highlight divs
        newAnchor.classList.add("comment-anchor", "latest");
        newNode.after(newAnchor);
        reorderAnchors();
    }
    newNode.addEventListener("mouseenter", hlighlightComment);
    newNode.addEventListener("mouseout", unhighlightComment);
}

function hlighlightComment() {
    if (this.classList.contains("comment-container")) {
        const id = this.id;
        this.classList.add("hovered");
        const hlId = document.querySelector(`[href="#${id}"]`).id;
        document
            .querySelectorAll(`[hl-id="${hlId}"]`)
            .forEach((hl) => hl.classList.add("hovered"));
    } else {
        const id = this.getAttribute("hl-id");
        document
            .querySelectorAll(`[hl-id="${id}"]`)
            .forEach((hl) => hl.classList.add("hovered"));
        const commentId = document
            .getElementById(id)
            .getAttribute("href")
            .replace("#", "");
        document.getElementById(commentId).classList.add("hovered");
    }
}

function unhighlightComment() {
    if (this.classList.contains("comment-container")) {
        const id = this.id;
        this.classList.remove("hovered");
        const hlId = document.querySelector(`[href="#${id}"]`).id;
        document
            .querySelectorAll(`[hl-id="${hlId}"]`)
            .forEach((hl) => hl.classList.remove("hovered"));
    } else {
        const id = this.getAttribute("hl-id");
        document
            .querySelectorAll(`[hl-id="${id}"]`)
            .forEach((hl) => hl.classList.remove("hovered"));
        const commentId = document
            .getElementById(id)
            .getAttribute("href")
            .replace("#", "");
        document.getElementById(commentId).classList.remove("hovered");
    }
}

function reorderAnchors() {
    document
        .querySelectorAll(".comment-anchor")
        .forEach((el, i) => el.setAttribute("order", i));
}

// from https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
function makeId() {
    var result = "";
    var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    var charactersLength = characters.length;
    for (var i = 0; i < 10; i++) {
        result += characters.charAt(
            Math.floor(Math.random() * charactersLength)
        );
    }
    return result;
}

let mouseDownTarget;
$(document).mousedown(function (e) {
    mouseDownTarget = e.target;
});

document.addEventListener("keydown", (e) => {
    const ctrl = ["Control", "Command"];
    if (ctrl.includes(e.key)) {
        ctrlPressed = true;
        return;
    }
    if (e.key === "Shift") {
        shiftPressed = true;
        return;
    }
    if (ctrlPressed && e.key === "s") {
        saveFile();
    }
    // don't know how to implement undo
    // if (ctrlPressed && e.key === "z") {
    //     console.log("undo");
    //     window.electron.sendToHost("undo:attempted", "");
    //     document
    //         .querySelectorAll("comment")
    //         .forEach((com) => renderComment(com));
    // }
});

document.addEventListener("keyup", (e) => {
    const ctrl = ["Control", "Command"];
    if (ctrl.includes(e.key)) ctrlPressed = false;
    if (e.key === "Shift") shiftPressed = false;
});
document.addEventListener("click", (e) => {
    window.electron.sendToHost("menu:close", "");
});

document.addEventListener("mouseup", function (e) {
    if (
        !mouseDownTarget ||
        mouseDownTarget.parentNode.classList.contains("comment")
    )
        return;
    const selectedText = window.getSelection().toString();
    const button = e.button;
    if (!selectedText && button !== 2) return;
    if (selectedText) {
        highlightSelection();
    } else if (button === 2) {
        const newSpan = document.createElement("span");
        newSpan.classList.add("highlight", "latest");
        window.getSelection().getRangeAt(0).surroundContents(newSpan);

        const newAnchor = document.createElement("a");
        newAnchor.classList.add("comment-anchor", "latest");
        newSpan.after(newAnchor);
    }
    makeCommentBox();
});

function makeCommentBox() {
    const activeSelectionDivs = document.querySelectorAll(".highlight.latest");
    const lastActive = activeSelectionDivs[activeSelectionDivs.length - 1];
    const commentContainer = document.createElement("div");
    commentContainer.id = makeId();
    commentContainer.classList.add("comment-container");
    const commentBox = document.createElement("div");
    // commentBox.id = makeId();
    commentBox.classList.add("comment");

    const commentInput = document.createElement("textarea");
    commentInput.classList.add("comment-input");
    commentInput.addEventListener("input", resizeCommentInput);
    const commentDisplay = document.createElement("div");
    commentDisplay.classList.add("comment-display", "hidden");
    commentBox.appendChild(commentDisplay);
    commentBox.appendChild(commentInput);
    commentContainer.appendChild(commentBox);
    // link to comment anchor
    document
        .querySelector("a.latest")
        .setAttribute("href", "#" + commentContainer.id);
    // commentBox.style.top = Math.max(lastActive.offsetTop, 0) - 16 + "px";
    document.querySelector(".marked_container").appendChild(commentContainer);
    reorderAnchors();
    positionComments();
    commentInput.focus();
    commentBox.addEventListener("focusout", function () {
        renderComment(this);
    });
    commentContainer.addEventListener("click", function () {
        editComment(this);
    });
    commentContainer.addEventListener("mouseover", hlighlightComment);
    commentContainer.addEventListener("mouseout", unhighlightComment);
    // observer.observe(commentBox, config);
}

function editComment(x) {
    const commentInput = x.querySelector(".comment-input");
    commentInput.classList.remove("hidden");
    commentInput.focus();
    x.querySelector(".comment-display").classList.add("hidden");
    x.classList.add("active");
    positionComments();
}
function renderComment(x) {
    const commentInput = x.querySelector(".comment-input");
    const commentText = commentInput.value.trim();
    commentInput.value = commentText;
    commentInput.style.height = "";
    commentInput.style.height = commentInput.scrollHeight + 3 + "px";
    const linkedAnchor = $(`[href*='${x.parentNode.id}']`);
    if (commentText) {
        $(".latest").removeClass("latest");
        const commentDisplay = x.querySelector(".comment-display");
        commentDisplay.innerHTML = marked(commentText);
        commentInput.classList.add("hidden");
        commentDisplay.classList.remove("hidden");
        x.parentNode.classList.remove("active");
    } else {
        // remove all highlight divs with hl-id equal to the id of linkedAnchor
        $(`[hl-id=${linkedAnchor.attr("id")}]`)
            .contents()
            .unwrap();
        $(`[hl-id=${linkedAnchor.attr("id")}]`).remove(); // remove empty highlight divs
        $(".highlight.latest").remove();
        const parentNode = linkedAnchor.parent();
        linkedAnchor.remove();
        x.parentNode.remove();
        parentNode.html(parentNode.html()); // collapse fragments caused by inserting highlight div
    }
    getComments();
    if (nCommentsOld === nCommentsNew) {
        if (commentContentsOld.join("") === commentContentsNew.join("")) {
            window.electron.sendToHost("file:unchanged");
            unsaved = false;
        }
    }
    reorderAnchors();
    positionComments();
}

function resizeCommentInput() {
    if (!unsaved) {
        unsaved = true;
        window.electron.sendToHost("file:changed");
    }
    const oldHeight = this.style.height;
    this.style.height = "";
    const newHeight = this.scrollHeight + 3 + "px";
    this.style.height = newHeight;
    if (this.value && oldHeight !== newHeight) {
        positionComments();
    }
}

function sendFileToWriter(last = false) {
    console.log("saving...");
    const docToSave = document.cloneNode(true);
    // unrender MathJax before saving
    docToSave
        .querySelectorAll(".math.display")
        .forEach(
            (el) =>
                (el.innerText =
                    "\\[" + el.querySelector("script").innerText + "\\]")
        );
    docToSave.querySelector("#electron-script").remove();
    window.electron.sendToMain("html:write", {
        path: filePath,
        bodyHTML: docToSave.body.innerHTML,
        lastFile: last,
    });
}

function getComments() {
    commentContentsNew = [];
    document
        .querySelectorAll(".comment-display")
        .forEach((com) => commentContentsNew.push(com.innerHTML));
    nCommentsNew = commentContentsNew.length;
}

function saveFile(last = false) {
    const activeComment = document.querySelector(".comment-container.active");
    if (activeComment) {
        editComment(activeComment);
        renderComment(activeComment.querySelector(".comment"));
    }
    getComments();
    nCommentsOld = nCommentsNew;
    commentContentsOld = commentContentsNew;
    window.electron.sendToHost("file:unchanged");
    unsaved = false;
    sendFileToWriter(last);
}
