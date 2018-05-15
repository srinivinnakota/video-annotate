"use strict"

var VideoAnnotator= (function () {

    // todo:prefix a bookmark with some text
    // todo: delete thumbnail and text,
    // todo: delete drawing

    var mouseX, mouseY, mouseDown = 0;
    var drawingColor = "#991111";
    var penColor = drawingColor;
    var currentNoteText = "";
    var currentTool = "none";
    const POSTIT_WIDTH = "25";
    const POSTIT_HEIGHT = "25";

    var currentNotePostit;
    var innerHeight;
    var overlay= {};
    var vid= {};
    var canvas= {};
    var notediv= {};
    var contentspane= {};
    var editing = {};
    var ctx;
    var notetextControl;
    var bookmarks;


    ///////////




    function draw(x, y, e) {
        if (currentTool === 'pencil') {

            var size = 2;
            var penColor = drawingColor;
            ctx.fillStyle = penColor;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.fill();
        } else if (currentTool === 'eraser') {
            ctx.clearRect(x, y, 100, 100);
        }

        saveDrawing();
    }

    function onMouseDown(e) {
        if ((currentTool === 'pencil') || (currentTool === 'eraser')) {
            mouseDown = 1;
            draw(mouseX, mouseY, e);
        }
    }

    function onMouseUp(e) {
        if ((currentTool === 'pencil') || (currentTool === 'eraser')) {
            mouseDown = 0;
        } else if (currentTool === 'note') {
            placeAPostItAtMousePosition(e);
            handleKeyEvents(104);//only one note per click, then the mode defaults to hand mode
            // make the note text control visible
            setTextAndFocusNoteText("");
        }
    }

    function setTextAndFocusNoteText(text) {
        var noteControl = document.getElementById('notetext');
        noteControl.style.display = 'block';
        noteControl.focus();
        noteControl.value = text;
    }

    function onKeyPress(e) {
        handleKeyEvents(e.keyCode);
    }

    function isMediaCurrentlyPlaying() {
        var retval = !!( (!vid.paused) && (!vid.ended) && (vid.readyState > 2));

        return retval;
    }

    function handleKeyEvents(keycode) {

        var elementToChange = document.getElementsByTagName("body")[0];

        // some keys are allowed while playing and some are not
        if (
            (keycode == 115)
            || (keycode == 110)
            || (keycode == 114)
        ) {
            if (isMediaCurrentlyPlaying()) {
                console.log('ignoring key because player is playing');
                return;
            }

            switch (keycode) {
                case 115: //'s'
                {
                    elementToChange.style.cursor = 'pointer';
                    currentTool = 'note';
                }
                    break;
                case 110: // 'crosshair'
                {
                    elementToChange.style.cursor = 'crosshair';
                    currentTool = 'pencil';
                }
                    break;
                case 114: // 'eraser'
                {
                    elementToChange.style.cursor = 'text';
                    currentTool = 'eraser';
                }
                    break;
            }
        } else if (
            (keycode == 104) // 'h' no tools
            || (keycode == 106) // 'j' left seek by 5 sec or 30 sec
            || (keycode == 108) // 'l' right seek by 5 sec or 30 sec
            || (keycode == 32) // spacebar
            || (keycode == 107) // 'k'
        ) {
            switch (keycode) {
                case 104: // h
                {
                    elementToChange.style.cursor = 'default';
                    currentTool = 'none';
                }
                    break;
                case 106: // j
                {
                    let newTime = vid.currentTime - 5.0;
                    vid.currentTime = (newTime < 0 ? 0 : newTime);
                }
                    break;
                case 108: // l
                {
                    let newTime = vid.currentTime + 5.0;
                    vid.currentTime = (newTime > vid.duration ? vid.duration : newTime);
                }
                    break;
                case 107: // space bar
                case 32: // space bar
                {
                    if (isMediaCurrentlyPlaying()) {
                        vid.pause();
                    } else {
                        vid.play();
                        onVideoPlaying();
                    }
                }
                    break;
            }

        }

    }

    function placeAPostItAtMousePosition(e) {
        var DOM_img = placeAPostItAt_xy(e.offsetX, e.offsetY, "postit_" + getUniqueID());

        // Store the image so that we can later store after the note text is done
        currentNotePostit = {
            potitthumbnailPosition: {
                top: DOM_img.style.top,
                left: DOM_img.style.left
            },
            postittext: "",
            postitDomId: DOM_img.id
        };

        addNote(currentNotePostit);

    }

    function placeAPostItAt_xy(x, y, domID) {
        var overlay = document.getElementById('overlay');
        var DOM_img = document.createElement("img");
        DOM_img.src = "positiGreen.jpg";
        DOM_img.style.width = POSTIT_WIDTH + "px";
        DOM_img.style.height = POSTIT_HEIGHT + "px";
        DOM_img.style.position = "absolute";
        DOM_img.style.top = y;
        DOM_img.style.left = x;
        DOM_img.style.zIndex = 20;
        DOM_img.classList.add("postit"); // so as to get click preference
        DOM_img.id = domID;
        DOM_img.addEventListener("mouseup", onPostitCliked, false);
        overlay.append(DOM_img);

        return DOM_img;
    }

    function getUniqueID() {
        return Math.random().toString().replace(".", "") + Math.random().toString().replace(".", "");
    }

    function onPostitCliked(e) {
        //alert("image clicked");
        e.stopPropagation();

        var clickedImageID = e.target.id;
        Object.keys(editing.annotations).sort().forEach(function (key) {
            var annotation = editing.annotations[key];
            annotation.notes.forEach(function (note) {
                if (note.postitDomId === clickedImageID) {
                    setTextAndFocusNoteText(note.postittext);
                    currentNotePostit = note;
                }
            });

        });
    }

    function onMouseMove(e) {
        getMousePos(e);
        if (mouseDown === 1) {
            draw(mouseX, mouseY, e);
        }
    }

    function getMousePos(e) {
        if (!e)
            var e = event;
        if (e.offsetX) {
            mouseX = e.offsetX;
            mouseY = e.offsetY;
        }
        else if (e.layerX) {
            mouseX = e.layerX;
            mouseY = e.layerY;
        }
    }

    function fixGeometry() {

        var ratioOfPictureHeightToTotalHeightOfVideo = 1085.0 / 1170.0;
        var mediaWidth = vid.videoWidth;
        var mediaHeight = vid.videoHeight;

        var availableWidth = window.innerWidth;
        var availableHeight = window.innerHeight;

        // we will assume always we have more screen width available than height
        var fullHeight = availableHeight - 10; // 466 // leave 10 pixels
        var fullWidth = mediaWidth * (fullHeight / mediaHeight);
        var canvasHeight = parseInt(ratioOfPictureHeightToTotalHeightOfVideo * fullHeight); //432;
        var controlsHeight = fullHeight - canvasHeight;
        var noteDivTop = fullHeight - parseInt(fullHeight * 0.3);//controlsHeight + fullHeight;
        var contentspaneLeft = fullWidth + 10; //900;


        // when I add width as style I do not seem to be able to get the pencil draw correctly.
        // So I need to add an attribute as below
        overlay.setAttribute("width", fullWidth + "px"); // not style width
        overlay.setAttribute("height", fullHeight + "px"); // not style width
        vid.setAttribute("width", fullWidth + "px"); // not style width
        vid.setAttribute("height", fullHeight + "px"); // not style width
        canvas.setAttribute("width", fullWidth + "px"); // not style width
        canvas.setAttribute("height", canvasHeight + "px"); // not style width
        notediv.style.top = noteDivTop + "px";
        contentspane.style.left = contentspaneLeft + "px";
    }


    function init() {

        editing = {};
        editing.annotations = {};

        contentspane = document.getElementById('contentspane');
        notediv = document.getElementById('note');
        canvas = document.getElementById('can');
        overlay = document.getElementById('overlay');
        ctx = canvas.getContext('2d')

        canvas.addEventListener('mousedown', onMouseDown, false);
        canvas.addEventListener('mousemove', onMouseMove, false);
        window.addEventListener('mouseup', onMouseUp, false);
        window.addEventListener('keypress', onKeyPress, false);

        notetextControl = document.getElementById('notetext');
        notetextControl.addEventListener('keypress', onKeyPressNoteControl, false);
        notetextControl.addEventListener('focusout', onNoteTextFocusOutHandler, false);

        // handle the bookmark list
        bookmarks = document.getElementById('bookmarkslist');
        bookmarks.onclick = handleBookMarkSelect;

        // make a event handler when the current playback position changes
        vid = document.getElementById("vid");
        //vid.ontimeupdate = onVideoTimeUpdate;
        vid.onplay = onVideoPlaying;
        //vid.onseeked= onSeeked;

        // load annotationsfromDatabase
        var databaseKey = document.getElementsByTagName('source')[0].src;
        if (!(localStorage[databaseKey] === undefined)) {
            editing = JSON.parse(localStorage[databaseKey]);
            refreshContentsAndPersist();
        }

        // Fix geometry
        fixGeometry();
    }

    function onVideoPlaying(e) {
        clearCanvasAndNotes();
        handleKeyEvents(104); // once we start playing we will reset the current tool and change the cursor to default
    }

    function clearCanvasAndNotes() {
        ctx.clearRect(0, 0, canvas.width, canvas.width);
        var notes = document.getElementsByClassName('postit');
        while (notes.length > 0) { // cannot use for loop because the list keeps shrinking
            notes[0].parentNode.removeChild(notes[0]);
        }
        currentNotePostit = undefined;
    }

    function handleBookMarkSelect(e) {
        var target = e.target;
        clearCanvasAndNotes();

        let li = e.target;
        let floatingPointTime = li.getAttribute("timemarker")
        activateAnnotation(floatingPointTime);
    }

    function activateAnnotation(key) {
        // display the annotation
        var annotation = editing.annotations[key];
        // if there is any scribbling on this annotation, then display canvas; else do not display canvas
        if (!(annotation.canvas === undefined)) {
            var img = new Image();
            img.onload = function () {
                ctx.drawImage(img, 0, 0);
            };
            img.src = annotation.canvas;
        }
        // display the note thumbnails only; cannot set text because there may be multiple notes
        annotation.notes.forEach(function (note) {
            placeAPostItAt_xy(note.potitthumbnailPosition.left, note.potitthumbnailPosition.top, note.postitDomId);
        });


        // seek to the position
        vid.currentTime = parseFloat(key);
    }

    function onKeyPressNoteControl(e) {
        currentNoteText = document.getElementById('notetext').value;
        e.stopPropagation();
    }

    function onNoteTextFocusOutHandler() {
        var notetextcontrol = document.getElementById('notetext');
        notetextcontrol.style.display = 'none';

        // Update noteText
        currentNotePostit.postittext = document.getElementById('notetext').value;
        refreshContentsAndPersist();
    }

    function addNote(note) {
        var annotations = editing.annotations;
        var currentPlayerPosition = document.getElementById("vid").currentTime;
        var key = currentPlayerPosition.toString();
        if (annotations[key] === undefined) {
            annotations[key] = {
                canvas: undefined,
                notes: []
            }
        }

        annotations[key].notes.push(note);
        refreshContentsAndPersist();
    }

    function saveDrawing() {
        var annotations = editing.annotations;
        var currentPlayerPosition = document.getElementById("vid").currentTime;
        var key = currentPlayerPosition.toString();
        if (annotations[key] === undefined) {
            annotations[key] = {
                canvas: undefined,
                notes: []
            }
        }

        annotations[key].canvas = canvas.toDataURL();
        refreshContentsAndPersist();
    }

    function convertToTime(floatTime) {
        let minutes = Math.trunc(floatTime / 60.0);
        let seconds = floatTime - (minutes * 60);

        return minutes + ":" + seconds;
    }

    function refreshContentsAndPersist() {

        // Delete displayed list of bookmarks.
        while (bookmarks.hasChildNodes()) {
            bookmarks.removeChild(bookmarks.lastChild);
        }

        // Redisplay sorted list of all bookmarks
        Object.keys(editing.annotations)
            .sort(function(a, b){return parseFloat(a)-parseFloat(b)})
            .forEach(function (key) {
            let li = document.createElement("li");
            li.setAttribute("timemarker", key);


            let textValue = convertToTime(parseFloat(key));
            let textNode = document.createTextNode(textValue);
            li.appendChild(textNode);
            bookmarks.appendChild(li);
        });

        // Persist the annotations collection
        editing.screenInfo = {width: window.innerWidth, height: window.innerHeight};
        var databaseKey = document.getElementsByTagName('source')[0].src;
        var databaseValue = JSON.stringify(editing);
        localStorage[databaseKey] = databaseValue;
    }

    function save() {
        var data = JSON.stringify(editing);
        var file = new Blob([data], {type: "application/json"});

        var a = document.createElement("a");
        var url = URL.createObjectURL(file);
        a.href = url;
        a.download = "filename";
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);

    }

    function load(e) {

        var files = e.files; // FileList object

        for (var i = 0; i < files.length; i++) {
            let f = files[i];
            console.log(f.name, ",", f.type);

            var reader = new FileReader();

            reader.onload = function (e) {
                //fileDisplayArea.innerText = reader.result;
                editing = JSON.parse(reader.result);
                resizeViewport(editing.screenInfo.width, editing.screenInfo.height);
                refreshContentsAndPersist();
            }

            reader.readAsBinaryString(f);


        }
    }

    function resizeViewport(width, height) {
        window.resizeTo(
            width + (window.outerWidth - window.innerWidth),
            height + (window.outerHeight - window.innerHeight)
        );
    }

    return {
        init:init,
        save: save
    };
})();
