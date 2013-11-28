function TopMenu(container, model)
{
	this._container = container;
	this.model = model;
	
	this.connectionModesDisplayOrder = ["Byp", "Line", "Calib", "Expr"];
	this.connectionModeCommands = {"Byp": 'bypass',
        	  "Line": 'linear',
        	  "Calib": 'calibrate',
        	  "Expr": 'expression'};
	this.connectionModes = ["None", "Byp", "Line", "Expr", "Calib"];

	this.boundaryModes = ["None", "Mute", "Clamp", "Fold", "Wrap"];
	this.boundaryIcons = ["boundaryNone", "boundaryUp", "boundaryDown",
	                     "boundaryMute", "boundaryClamp", "boundaryWrap"];
}

TopMenu.prototype = {
		
		/**
		 * Initialize the Top Menu Bar Component
		 */
		init : function () 
		{ 
			var _self = this;				// to pass to context of THIS to event handlers
			
			$(this._container).empty();		// clear the container DIV
			
			window.saveLocation = '';		// Where the network will be saved
			
			$(this._container).append(
			        "<div class='topMenu'>"+
		                "<div id='logoWrapper'>"+
		                    "<img id='logo' alt=''webmapper logo' src='images/webmapperlogo.png' width='59' height='40'>"+
		                "</div>"+
			            "<div id='saveLoadDiv'>"+
			                "<li><a id='loadButton'>Load</a></li>"+
			                "<li><a id='saveButton'>Save</a></li>"+
			            "</div>"+
			            "<div><select id='modeSelection'>"+
			                "<option value='list' selected>List</option>"+
			                "<option value='grid'>Grid</option>"+
			                "<option value='hive'>Hive</option>"+
			                "<option value='balloon'>Balloon</option>"+
			            "</select></div>"+
			    "</div>"
		    );

		    //Add the mode controls
		    $('.topMenu').append("<div class='modesDiv signalControl disabled'></div>");
		    for (var m in this.connectionModesDisplayOrder) {
		        $('.modesDiv').append(
		            "<div class='mode mode"+this.connectionModesDisplayOrder[m]+"'>"+this.connectionModesDisplayOrder[m]+"</div>");
		    }

		    $('.modesDiv').append("<input type='text' size=25 class='expression'></input>");

		    //Add the range controls
		    $('.topMenu').append(
		        "<div id='srcRange' class='range signalControl disabled'>Src Range:</div>"+
		        "<div id='destRange' class='range signalControl disabled'>Dest Range:</div>");
		    $('.range').append("<input><input>");
		    $('.range').children('input').each( function(i) {
		        var minOrMax = 'Max';   // A variable storing minimum or maximum
		        var srcOrDest = 'Src';
		        if(i%2==0)  minOrMax = 'Min';
		        if(i>1)     srcOrDest = 'Dest';
		        $(this).attr({
		            'maxLength': 15,
		            "size": 5,
		            // Previously this was stored as 'rangeMin' or 'rangeMax'
		            'class': 'range',   
		            'id': 'range'+srcOrDest+minOrMax,
		            'index': i
		        });
		    });
		    $("<input id='boundaryMin' class='boundary boundaryDown' type='button'></input>").insertBefore('#rangeDestMin');
		    $("<input id='boundaryMax' class='boundary boundaryUp' type='button'></input>").insertAfter('#rangeDestMax');
		    
		    // extra tools
		    $('.topMenu').append(
		            "<div id='wsstatus' class='extratools'>websocket uninitialized</div>"+
		            "<div id='refresh' class='extratools'>");
		    
		    this.addHandlers();
		},
		
		addHandlers : function ()
		{
			var _self = this;
			
			//The expression and range input handlers
		    $('.topMenu').on({
		        keydown: function(e) {
		            e.stopPropagation();
		            if(e.which == 13) //'enter' key
		                _self.selected_connection_set_input( $(this).attr('class').split(' ')[0], this, $(this).attr('index') );
		        },
		        click: function(e) { e.stopPropagation(); },
		        blur: function() {_self.selected_connection_set_input( $(this).attr('class').split(' ')[0], this, $(this).attr('index') );}
		    }, 'input');
			
		    //For the mode buttons
		    $('.topMenu').on("click", '.mode', function(e) {
		        e.stopPropagation();
		        _self.selected_connection_set_mode(e.currentTarget.innerHTML);
		    });

		    //For the visualization mode selection menu
		    $('#modeSelection').change( function(e) {
		        var newMode = $('#modeSelection').val();
		        $(_self._container).trigger("switchView", [newMode]);	// trigger switch event
		    });

		    $('#saveButton').on('click', function(e) {
		        e.stopPropagation();
		    });

		    $('#loadButton').click(function(e) {
		        e.stopPropagation();
		        _self.on_load();
		    });

		    $('.boundary').on('click', function(e) {
		        _self.on_boundary(e);
		    });

		    $('body').on('keydown', function(e) {
		        if( e.which == 77 ) 
		        	_self.mute_selected();
		    });
		    
		    $('#refresh').on('click', function(e) { 
		        $(this).css({'-webkit-animation': 'refreshSpin 1s'});
		        $(this._container).trigger("refreshAll");
		        setTimeout(function(){
		            $('#refresh').css({'-webkit-animation': ''});
		        }, 1000);
		    });
		},
		
		/**
		 * Updates the save/loading functions based on the view's state
		 * currently set up for the list view only
		 */
		updateSaveLocation : function (location)
		{
			// get the save location
			if(location){
				window.saveLocation = location;
			}else{
				window.saveLocation = '';
			}
			
			// update the save button's link
			$('#saveButton').attr('href', window.saveLocation);

			// if saving is not ready, disable the save button
			if(window.saveLocation == '')	
			{
				$('#saveButton, #loadButton').addClass('disabled');
			}
			// if saving is ready, enable the save button
			else
			{
				$('#saveButton, #loadButton').removeClass('disabled');
			}
		},
		
		// conn object with arguments for the connection
		// conns array of connections to update
		updateConnectionPropertiesFor : function(conn, conns)
		{
		    if (conns.length == 1) {
		        if (conns[0].src_name == conn.src_name
		            && conns[0].dest_name == conn.dest_name)
		        {
		            this.updateConnectionProperties(conns);
		        }
		    }
		},
		
		updateConnectionProperties : function(conns)
		{
		    var clear_props = function() {
		        $(".mode").removeClass("modesel");
		        $("*").removeClass('waiting');
		        $(".topMenu input").val('');
		        //$('.boundary').removeAttr('class').addClass('boundary boundaryNone');
		        $('.signalControl').children('*').removeClass('disabled');
		        $('.signalControl').addClass('disabled');
		    };

			// if there is one connection selected, display its properties on top
		    if (conns.length == 1) {
		        var c = conns[0];
		        var mode = this.connectionModes[c.mode];
		        clear_props();
		        $('.signalControl').removeClass('disabled');
		        $('.signalControl').children('*').removeClass('disabled');
		        $(".mode"+mode).addClass("modesel");

		        if(mode != "Expr") 
		            $('.expression').addClass('disabled');

		        if(mode != "Line")
		            $('#srcRange').addClass('disabled');

		        $(".expression").val(c.expression);
		        if (c.range[0]!=null) { $("#rangeSrcMin").val(c.range[0]); }
		        if (c.range[1]!=null) { $("#rangeSrcMax").val(c.range[1]); }
		        if (c.range[2]!=null) { $("#rangeDestMin").val(c.range[2]); }
		        if (c.range[3]!=null) { $("#rangeDestMax").val(c.range[3]); }
		        if (c.bound_min!=null) { this.set_boundary($("#boundaryMin"),c.bound_min,0);};
		        if (c.bound_max!=null) { this.set_boundary($("#boundaryMax"),c.bound_max,1);};
		    }
		    else {
		        clear_props();
		        // Figure out what the heck to do for multiple selected connections
		    }
		},
		
		
		selected_connection_set_input : function (what,field,idx)
		{
		    var args = this.copy_selected_connection();

		    if( !args ) return;

		    // Return if there is no change
		    if ( args[what][idx] == parseFloat(field.value) || args[what] == field.value) return;

		    // TODO: this is a bit out of hand, need to simplify the mode
		    // strings and indexes.
		    var modecmd = this.connectionModeCommands[this.connectionModes[args['mode']]];
		    args['mode'] = modecmd;

		    // adjust the field
		    if (idx===undefined)
		        args[what] = field.value;
		    else
		        args[what][idx] = parseFloat(field.value);

		    // send the command, should receive a /connection/modify message after.
		    $(this._container).trigger("setConnection", [args]);

		    $(field).addClass('waiting');
		},
		
		selected_connection_set_mode : function (modestring)
		{
		    var modecmd = this.connectionModeCommands[modestring];
		    if (!modecmd) return;

		    var args = this.copy_selected_connection();

		    // adjust the mode
		    args['mode'] = modecmd;

		    // send the command, should receive a /connection/modify message after.
		    $(this._container).trigger("setConnection", [args]);	// trigger switch event
		},

		copy_selected_connection : function ()
		{
		    var conns = view.get_selected_connections(model.connections);
		    if (conns.length!=1) return;
		    var args = {};

		    // copy existing connection properties
		    for (var c in conns[0]) {
		        args[c] = conns[0][c];
		    }
		    return args;
		},
		
		on_load : function()
		{
			var _self = this;
			
		    //A quick fix for now to get #container out of the way of the load dialogs
		    var body = document.getElementsByTagName('body')[0];
		    var iframe = document.createElement('iframe');
		    iframe.name = 'file_upload';
		    iframe.style.visibility = 'hidden';
		    body.appendChild(iframe);

		    var form = document.createElement('form');
		    form.innerHTML = '<input id="file" type="file"                   \
		                       name="mapping_json" size="40" accept="json">  \
		                      <input type="submit" style="display: none;">   \
		                      <input type="button" value="Cancel" id="cancel">';
		    form.method = 'POST';
		    form.enctype = 'multipart/form-data';
		    form.action = '/load';
		    form.target = 'file_upload';

		    var l = document.createElement('li');
		    l.appendChild(form);
		    $('.topMenu').append(l);

		    iframe.onload = function(){
		        var t = $(iframe.contentDocument.body).text();
		        if (t.search('Success:')==-1 && t.search('Error:')==-1)
		            return;
		        _self.notify($(iframe.contentDocument.body).text());
		        $(l).remove();
		        body.removeChild(iframe);
		    };

		    $('#cancel',form).click(function(){
		        $(l).remove();
		        $('#container').removeClass('onLoad');
		        body.removeChild(iframe);
		    });

		    form.firstChild.onchange = function(){

		        var fn = document.createElement('input');
		        fn.type = 'hidden';
		        fn.name = 'filename';
		        fn.value = form.firstChild.value;
		        form.appendChild(fn);

		        // The devices currently in focused
		        var devs = view.get_focused_devices();
		        // Split them into sources and destinations
		        var srcdevs = [];
		        var destdevs = [];
		        for (var i in devs.contents) {
		            if( devs.contents[i].n_outputs )
		                srcdevs.push( devs.contents[i].name );
		            if( devs.contents[i].n_inputs )
		                destdevs.push( devs.contents[i].name );
		        }

		        //So that the monitor can see which devices are being looked at
		        var srcs = document.createElement('input');
		        srcs.type = 'hidden';
		        srcs.name = 'sources';
		        srcs.value = srcdevs.join(); 
		        form.appendChild(srcs);
		        var dests = document.createElement('input');
		        dests.type = 'hidden';
		        dests.name = 'destinations';
		        dests.value = destdevs.join(); 
		        form.appendChild(dests);

		        form.submit();
		    };
		    return false;
		},
		
		on_boundary : function(e)
		{
		    for (var i in this.boundaryIcons) {
		        if ($(e.currentTarget).hasClass(this.boundaryIcons[i]))
		            break;
		    }
		    if (i >= this.boundaryIcons.length)
		        return;

		    var b = [0, 3, 3, 1, 2, 4][i];
		    b = b + 1;
		    if (b >= this.boundaryModes.length)
		        b = 0;

		    // Enable this to set the icon immediately. Currently disabled
		    // since the 'waiting' style is not used to indicate tentative
		    // settings for boundary modes.

		    // set_boundary($(e.currentTarget), b,
		    //              e.currentTarget.id=='boundaryMax');

		    selected_connection_set_boundary(b, e.currentTarget.id=='boundaryMax',
		                                     e.currentTarget);

		    e.stopPropagation();
		},
		
		selected_connection_set_boundary : function (boundarymode, ismax, div)
		{
		    var args = this.copy_selected_connection();

		    if( !args ) 
		    	return;

		    // TODO: this is a bit out of hand, need to simplify the mode
		    // strings and indexes.
		    var modecmd = this.connectionModeCommands[connectionModes[args['mode']]];
		    args['mode'] = modecmd;

		    var c = ismax ? 'bound_max' : 'bound_min';
		    args[c] = boundarymode;

		    // send the command, should receive a /connection/modify message after.
		    $(this._container).trigger("setConnection", [args]);	

		    // Do not set the background color, since background is used to
		    // display icon.  Enable this if a better style decision is made.
		    //$(div).addClass('waiting');
		},
		
		notify : function (msg)
		{
		    var li = document.createElement('li');
		    li.className = 'notification';
		    li.innerHTML = msg;
		    $('.topMenu').append(li);
		    setTimeout(function(){
		        $(li).fadeOut('slow', function(){ $(li).remove();});
		    }, 5000);
		},
		
		set_boundary : function (boundaryElement, value, ismax)
		{
		    for (var i in this.boundaryIcons)
		        boundaryElement.removeClass(this.boundaryIcons[i]);

		    if (value == 0) {//'None' special case, icon depends on direction
		        if (ismax)
		            boundaryElement.addClass('boundaryUp');
		        else
		            boundaryElement.addClass('boundaryDown');
		    }

		    if (value == 3) { //'Fold' special case, icon depends on direction
		        if (ismax)
		            boundaryElement.addClass('boundaryDown');
		        else
		            boundaryElement.addClass('boundaryUp');
		    }
		    else if (value < 5) {
		        boundaryElement.addClass('boundary'+ this.boundaryModes[value]);
		    }
		},
		
		mute_selected : function()
		{
		    var conns = view.get_selected_connections(model.connections);

		    for ( var i in conns ) {
		        var args = conns[i];
		        if ( args.muted == 0 ) {
		            args.muted = 1;
		        }
		        else 
		            args.muted = 0;

		        // TODO: why modes aren't just stored as their strings, I don't know
		        var modecmd = connectionModeCommands[connectionModes[args['mode']]];
		        args['mode'] = modecmd;

		        $(this._container).trigger("setConnection", [args]);
		    }
		}

};








