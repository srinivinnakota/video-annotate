"use strict"

var VideoAnnotator= (function () {

    // todo:prefix a bookmark with some text
    // todo: delete thumbnail and text,
    // todo: delete drawing

    var mouseX, mouseY, mouseDown = 0;
    var prevmouseX, prevmouseY = 0; // we remember previous x,y position to make the line smooth
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
    var bookmarksdiv;

	var thisCurrentGeometryInfo= {
		// all numbers below starting "this" are for storing "context" info with every note or a free drawing.
		// they will be useful restoring notes/drawings later
		thisFullWidth: -9999,
		thisFullHeight: -8888,
		thisMediaWidth: -7777,
		thisMediaHeight: -6666,
		thisWindowInnerWidth: -5555,
		thisWindowInnerHeight: -4444,
		thisCanvasWidth: -3333,
		thisCanvasHeight: -2222
	}
    ///////////




    function draw(e) {
		// refer : https://stackoverflow.com/questions/3783419/smooth-user-drawn-lines-in-canvas
        if (currentTool === 'pencil') {

            var size = 2;
            var penColor = drawingColor;
            
			// they are the same means we are beginning to draw, so first move then begin path. Otherwise we
			// first begin path, then move
			if((prevmouseX == mouseX) && (prevmouseY == mouseY)){
				ctx.moveTo(prevmouseX, prevmouseY);
				ctx.beginPath();
			} else {
				ctx.beginPath();
				ctx.moveTo(prevmouseX, prevmouseY);
			}

			ctx.lineCap = 'round';
			ctx.lineWidth = 3;
			ctx.lineTo(mouseX, mouseY);
			ctx.strokeStyle = penColor;
			ctx.stroke();

			// By not closing path we get smoother and faster update in UI
			//ctx.closePath();  

			console.log("draw x,y:" + mouseX + "," + mouseY);
        } else if (currentTool === 'eraser') {
            ctx.clearRect(mouseX, mouseX, 100, 100);
        }

        saveDrawing();
    }

    function onMouseDown(e) {
		console.log("mouse down entered");
        if ((currentTool === 'pencil') || (currentTool === 'eraser')) {
			console.log("mouse down pencil or eraser");
            mouseDown = 1;
			mouseX= -1;
			mouseY= -1;


            //draw(e);			
        }
    }

    function onMouseUp(e) {
		console.log("mouse up entered");
        if ((currentTool === 'pencil') || (currentTool === 'eraser')) {
			console.log("mouse up pencil or eraser");
            mouseDown = 0;
        } else if (currentTool === 'note') {
			console.log("mouse up note");
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
            postitDomId: DOM_img.id,
			CurrentGeometryInfo: {...thisCurrentGeometryInfo} // we need to store a copy, not a reference
        };

        addNote(currentNotePostit);

    }

    function placeAPostItAt_xy(_x, _y, domID) {
		// var nx= parseInt(x.substring(0, x.length-2)); // remove "px"
		// nx= Math.round((nx*968.8888*1.0)/1281.7778);
		// x= nx.toString() + "px";		
        var overlay = document.getElementById('overlay');
        var DOM_img = document.createElement("img");
        DOM_img.src = "positiGreen.jpg";
        DOM_img.style.width = POSTIT_WIDTH + "px";
        DOM_img.style.height = POSTIT_HEIGHT + "px";
        DOM_img.style.position = "absolute";
        DOM_img.style.top = _y;
        DOM_img.style.left = _x;
        DOM_img.style.zIndex = 20;
        DOM_img.classList.add("postit"); // so as to get click preference
        DOM_img.id = domID;
        DOM_img.addEventListener("mouseup", onPostitCliked, false);
        overlay.append(DOM_img);

        return DOM_img;
    }

	function ScalePositions(x, y, GeometryAtTimeOfAnnotation){
		var newx= -12345;
		var newy= -23456;
		var availableWidthAtTimeOfAnnotation= -8989;
		var availableHeightAtTimeOfAnnotation= -4545;
		var mediaWidthAtTimeOfAnnotation= -1212;
		var mediaHeightAtTimeOfAnnotation= -2323;

		if(GeometryAtTimeOfAnnotation == undefined){
			// get old numbers
			mediaWidthAtTimeOfAnnotation= 1920; //vid.videoWidth;
			mediaHeightAtTimeOfAnnotation = 1080; //vid.videoHeight;
			
			/*
			For following parameters, following calues are possible. 
			task bars, bookmarkbar_Y/N, scaling 250% or 200%
			1, N, 200
			1, N, 250
			1, Y, 200
			1, Y, 250
			2, N, 200
			2, N, 250
			2, Y, 200
			2, Y, 250
			*/

			
			var LegacyMigrationConstants= [
				{availableWidth: 1536, availableHeight: 699, canvaswidth: 0, canvasheight: 0 }, // 2 taskbar, bookmarkbar, 250%
				{availableWidth: 1536, availableHeight: 731, canvaswidth: 0, canvasheight: 0 }, // 2 taskbar, No-bookmark, 250%
				{availableWidth: 1536, availableHeight: 731, canvaswidth: 0, canvasheight: 0 }, // 1 taskbar, bookmarkbar, 250%
				{availableWidth: 1536, availableHeight: 763, canvaswidth: 0, canvasheight: 0 }, // 1 taskbar, No-bookmark, 250%

				{availableWidth: 1920, availableHeight: 916, canvaswidth: 0, canvasheight: 0 }, // 2 taskbar, bookmarkbar, 200%
				{availableWidth: 1920, availableHeight: 948, canvaswidth: 0, canvasheight: 0 },    // 2 taskbar, No-bookmark, 200%			
				{availableWidth: 1920, availableHeight: 947, canvaswidth: 0, canvasheight: 0 }, // 1 taskbar, bookmarkbar, 200%
				{availableWidth: 1920, availableHeight: 979, canvaswidth: 0, canvasheight: 0 }, // 1 taskbar, No-bookmark, 200%
			];
		
			var LegacyOption= 2; //1 taskbar, bookmarkbar, 250%

			var availableWidthAtTimeOfAnnotation = LegacyMigrationConstants[LegacyOption].availableWidth; //window.innerWidth;
			var availableHeightAtTimeOfAnnotation = LegacyMigrationConstants[LegacyOption].availableHeight; //window.innerHeight;

		}else {
			var mediaWidthAtTimeOfAnnotation = GeometryAtTimeOfAnnotation.thisMediaWidth;
			var mediaHeightAtTimeOfAnnotation = GeometryAtTimeOfAnnotation.thisMediaHeight;

			var availableWidthAtTimeOfAnnotation = GeometryAtTimeOfAnnotation.thisFullWidth;
			var availableHeightAtTimeOfAnnotation = GeometryAtTimeOfAnnotation.thisFullHeight;
		}

		// we will assume always we have more screen width available than height
		var ratioOfPictureHeightToTotalHeightOfVideo = 1085.0 / 1170.0;
		//var fullHeight = availableHeightAtTimeOfAnnotation - 10; // 466 // leave 10 pixels
		var fullWidth = mediaWidthAtTimeOfAnnotation * (availableHeightAtTimeOfAnnotation / mediaHeightAtTimeOfAnnotation);

		// Now scale
		newx= Scale(x, thisCurrentGeometryInfo.thisFullWidth/fullWidth);
		newy= Scale(y, thisCurrentGeometryInfo.thisFullHeight/availableHeightAtTimeOfAnnotation);


		return {x:newx, y:newy};
	}

	function Scale(pos, factor){
		var n= parseInt(pos.substring(0, pos.length-2)); // remove "px"
		n= Math.round(n*factor);
		var newpos= n.toString() + "px";
		return newpos;
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
            draw(e);
        }
    }

    function getMousePos(e) {
        if (!e){
            e = event;
		}
		console.log("Begin get mousepos, prev:" + prevmouseX +", " + prevmouseY)
		prevmouseX = mouseX;
		prevmouseY = mouseY;

        if (e.offsetX) {
            mouseX = e.offsetX;
            mouseY = e.offsetY;
        }
        else if (e.layerX) {
            mouseX = e.layerX;
            mouseY = e.layerY;
        }

		if(prevmouseX == -1){
			prevmouseX = mouseX;
			prevmouseY = mouseY;
		}
		console.log("End get mousepos, prev:" + prevmouseX +", " + prevmouseY+ ", " + mouseX +", " + mouseY)

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
		//thisFullHeight= fullHeight;
		//thisFullWidth= fullWidth;
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
        bookmarksdiv.style.height= vid.videoHeight + "px";

		// make a copy of current geometry
		thisCurrentGeometryInfo= {
			thisFullWidth: fullWidth,
			thisFullHeight: fullHeight,
			thisMediaWidth: mediaWidth,
			thisMediaHeight: mediaHeight,
			thisWindowInnerWidth: availableWidth,
			thisWindowInnerHeight: availableHeight,
			thisCanvasWidth: fullWidth,
			thisCanvasHeight: canvasHeight
		};


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

        bookmarksdiv= document.getElementById('bookmarksdiv');



        // load annotationsfromDatabase
        var databaseKey = document.getElementsByTagName('source')[0].src;
        if (!(localStorage[databaseKey] === undefined)) {
            editing = JSON.parse(localStorage[databaseKey]);
            refreshContentsAndPersist();
        }

        // Fix geometry
        fixGeometry();

        //unload event
        var bodyelement= document.getElementsByTagName("body")[0];
        bodyelement.onbeforeunload= onbeforeunload;
        window.onbeforeunload= onbeforeunload;


    }

    function onbeforeunload(e) {
        var message = "You have not filled out the form.";
        //var e = e2 || window.event;
        //if (e) {
        //    e.returnValue = message;
        //}
        e.returnValue = message;
        //return message;
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
			//var width= thisFullWidth;
			//var height= thisFullHeight;
            img.onload = function () {
                //ctx.drawImage(img, 0, 0);
				ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas.width, canvas.height);
            };
            img.src = annotation.canvas;
        }
        // display the note thumbnails only; cannot set text because there may be multiple notes
        annotation.notes.forEach(function (note) {
			// scale 
			var newpos= ScalePositions(note.potitthumbnailPosition.left, note.potitthumbnailPosition.top, note.CurrentGeometryInfo);
            placeAPostItAt_xy(newpos.x, newpos.y, note.postitDomId);
        });

		// if only one note, display it
		if(annotation.notes.length == 1){
			var note= annotation.notes[0];
			setTextAndFocusNoteText(note.postittext);
                    currentNotePostit = note;
		}


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
        annotations[key].GeometryInfoForCanvas = {...thisCurrentGeometryInfo} // we need to store a copy, not a reference
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

		// if we dont clear from time to time we will have exceptions because we exceeded storage quota
		alert("run localStorage.clear() from console after saving");

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
        save: save,
        load:load,
        onbeforeunload:onbeforeunload
    };
})();
