"use strict";
var model = new LibMapperModel();

var all_devices = 'All Devices';

var connectionModes = ["None", "Byp", "Line", "Expr", "Calib"];
var connectionModesDisplayOrder = ["Byp", "Line", "Calib", "Expr"];
var connectionModeCommands = {"Byp": 'bypass',
                          "Line": 'linear',
                          "Calib": 'calibrate',
                          "Expr": 'expression'};
var boundaryModes = ["None", "Mute", "Clamp", "Fold", "Wrap"];
var boundaryIcons = ["boundaryNone", "boundaryUp", "boundaryDown",
                 "boundaryMute", "boundaryClamp", "boundaryWrap"];

//A global variable storing which display mode is currently in use
var view;
var viewIndex;					// to index into viewData 
var viewData = new Array(3);	// data specific to the view, change 3 the number of views


//Where the network will be saved
var saveLocation = '';
var selectedTab;
window.saveLocation = '';
/* Kick things off. */
window.onload = main;

function switch_mode(newMode)
{
	if(view)
	{
		// save view settings
		if(typeof view.save_view_settings == 'function')
			viewData[viewIndex] = view.save_view_settings();
		
		// tell the view to cleanup (ex: removing event listeners)
		view.cleanup();
	}
	
    $('#container').empty();
    switch(newMode)
    {
        case 'list':
            view = new listView(model);
            viewIndex = 0;
            view.init();
            break;
        case 'grid':
        	view = new GridView(document.getElementById('container'), model);
        	viewIndex = 1;
        	$('#saveLoadDiv').removeClass('disabled');
        	view.update_display();
        	break;
        case 'hive':
        	view = new HivePlotView(document.getElementById('container'), model);
        	viewIndex = 2;
        	view.on_resize();
        	break;
        case 'balloon':
        	view = new BalloonView(document.getElementById('container'), model);
        	viewIndex = 3;
            view.init();
            if(viewData[viewIndex])
      	    	view.load_view_settings(viewData[viewIndex]);
            view.update_display();
        	break;
        default:
            //console.log(newMode);
    }
    
    // load view settings if any
    if(viewData[viewIndex]){
	    if(typeof view.load_view_settings == 'function')
	    		view.load_view_settings(viewData[viewIndex]);
    }
}

function refresh_all()
{
    model.devices = new Assoc();
    model.signals = new Assoc();
    model.links = new Assoc();
    model.connections = new Assoc();
    view.update_display();
    command.send('refresh');
}


function update_save_location()
{
    if (selectedTab==all_devices) {
        $('#saveButton, #loadButton').addClass('disabled');
    }
    else 
        $('#saveButton, #loadButton').removeClass('disabled');

    $('#saveButton').attr('href', window.saveLocation);
}

function on_load()
{
    //A quick fix for now to get #container out of the way of the load dialogs
    $('#container').addClass('onLoad');
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
        notify($(iframe.contentDocument.body).text());
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
}

function notify(msg)
{
    var li = document.createElement('li');
    li.className = 'notification';
    li.innerHTML = msg;
    $('.topMenu').append(li);
    setTimeout(function(){
        $(li).fadeOut('slow', function(){ $(li).remove();});
    }, 5000);
    setTimeout(function(){
        $('#container').removeClass('onLoad');
    }, 6000);
}

function update_connection_properties()
{
    if (selectedTab == all_devices)
        return;

    var clear_props = function() {
        $(".mode").removeClass("modesel");
        $("*").removeClass('waiting');
        $(".topMenu input").val('');
        //$('.boundary').removeAttr('class').addClass('boundary boundaryNone');
        $('.signalControl').children('*').removeClass('disabled');
        $('.signalControl').addClass('disabled');
    };

    var conns = view.get_selected_connections(model.connections);
	// if there is one connection selected, display its properties on top
    if (conns.length > 1) {
        // Figure out what the heck to do for multiple connections
        clear_props();
    }
    if (conns.length == 1) {
        var c = conns[0];
        var mode = connectionModes[c.mode];
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
        if (c.bound_min!=null) { set_boundary($("#boundaryMin"),c.bound_min,0);};
        if (c.bound_max!=null) { set_boundary($("#boundaryMax"),c.bound_max,1);};
    }
    else {
        clear_props();
    }
}

function update_connection_properties_for(conn, conns)
{
    if (conns.length == 1) {
        if (conns[0].src_name == conn.src_name
            && conns[0].dest_name == conn.dest_name)
        {
            update_connection_properties();
        }
    }
}

function set_boundary(boundaryElement, value, ismax)
{
    for (var i in boundaryIcons)
        boundaryElement.removeClass(boundaryIcons[i]);

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
        boundaryElement.addClass('boundary'+boundaryModes[value]);
    }
}

function copy_selected_connection()
{
    var conns = view.get_selected_connections(model.connections);
    if (conns.length!=1) return;
    var args = {};

    // copy existing connection properties
    for (var c in conns[0]) {
        args[c] = conns[0][c];
    }
    return args;
}

function selected_connection_set_mode(modestring)
{
    var modecmd = connectionModeCommands[modestring];
    if (!modecmd) return;

    var args = copy_selected_connection();

    // adjust the mode
    args['mode'] = modecmd;

    // send the command, should receive a /connection/modify message after.
    command.send('set_connection', args);
}

function selected_connection_set_input(what,field,idx)
{
    var args = copy_selected_connection();

    if( !args ) return;

    // Return if there is no change
    if ( args[what][idx] == parseFloat(field.value) || args[what] == field.value) return;

    // TODO: this is a bit out of hand, need to simplify the mode
    // strings and indexes.
    var modecmd = connectionModeCommands[connectionModes[args['mode']]];
    args['mode'] = modecmd;

    // adjust the field
    if (idx===undefined)
        args[what] = field.value;
    else
        args[what][idx] = parseFloat(field.value);

    // send the command, should receive a /connection/modify message after.
    command.send('set_connection', args);

    $(field).addClass('waiting');
}

function selected_connection_set_boundary(boundarymode, ismax, div)
{
    var args = copy_selected_connection();

    if( !args ) return;

    // TODO: this is a bit out of hand, need to simplify the mode
    // strings and indexes.
    var modecmd = connectionModeCommands[connectionModes[args['mode']]];
    args['mode'] = modecmd;

    var c = ismax ? 'bound_max' : 'bound_min';
    args[c] = boundarymode;

    // send the command, should receive a /connection/modify message after.
    command.send('set_connection', args);

    // Do not set the background color, since background is used to
    // display icon.  Enable this if a better style decision is made.
    //$(div).addClass('waiting');
}

function on_boundary(e)
{
    for (var i in boundaryIcons) {
        if ($(e.currentTarget).hasClass(boundaryIcons[i]))
            break;
    }
    if (i >= boundaryIcons.length)
        return;

    var b = [0, 3, 3, 1, 2, 4][i];
    b = b + 1;
    if (b >= boundaryModes.length)
        b = 0;

    // Enable this to set the icon immediately. Currently disabled
    // since the 'waiting' style is not used to indicate tentative
    // settings for boundary modes.

    // set_boundary($(e.currentTarget), b,
    //              e.currentTarget.id=='boundaryMax');

    selected_connection_set_boundary(b, e.currentTarget.id=='boundaryMax',
                                     e.currentTarget);

    e.stopPropagation();
}

function mute_selected()
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

        command.send('set_connection', args);
    }
}

var updateCallable = true;
var updateTimeout;
function update_display() {
    if(updateCallable == false) {
        clearTimeout(updateTimeout)
    }
    updateCallable = false;
    updateTimeout = setTimeout(function() {
        view.update_display();
    });
}

/* The main program. */
function main()
{
    //Create the page elements
    add_container_elements();
    add_signal_control_bar();
    add_extra_tools();

    command.register("all_devices", function(cmd, args) {
        for (var d in args)
            model.devices.add(args[d].name, args[d]);
        update_display();
    });
    command.register("new_device", function(cmd, args) {
        model.devices.add(args.name, args);
        update_display();
    });
    command.register("del_device", function(cmd, args) {
        model.devices.remove(args.name);
        update_display();
    });
    command.register("mod_device", function(cmd, args) {
        // Remove original device
        model.devices.remove(args.name);
        // Remove all child signals before syncing
        var sigs = model.signals.keys();
        for (var i in sigs ) {
            if ( sigs[i].search(args.name) == 0 ) {
                model.signals.remove(sigs[i]);
            }
        }
        model.devices.add(args.name, args);
        command.send('get_signals_by_device_name', args.name);
        update_display();
    })
    command.register("all_signals", function(cmd, args) {
        for (var d in args)
            model.signals.add(args[d].device_name+args[d].name + '/_dir_'+args[d].direction, args[d]);
        update_display();
    });
    command.register("new_signal", function(cmd, args) {
        model.signals.add(args.device_name+args.name + '/_dir_'+args.direction, args);
        update_display();
    });
    command.register("del_signal", function(cmd, args) {
        model.signals.remove(args.device_name+args.name + '/_dir_'+args.direction);
        update_display();
    });
    command.register("all_links", function(cmd, args) {
        for (var l in args)
            model.links.add(args[l].src_name + '>' + args[l].dest_name, args[l]);
        update_display();
    });
    command.register("new_link", function(cmd, args) {
        model.links.add(args.src_name+'>'+args.dest_name, args);
        update_display();
    });
    command.register("del_link", function(cmd, args) {
        model.links.remove(args.src_name+'>' + args.dest_name);
        update_display();
    });

    command.register("all_connections", function(cmd, args) {
        for (var d in args)
            model.connections.add(args[d].src_name + '>' + args[d].dest_name, args[d]);
        update_display();
        for (var d in args)
            update_connection_properties_for(args[d], view.get_selected_connections(model.connections));
    });
    command.register("new_connection", function(cmd, args) {
        model.connections.add(args.src_name + '>' + args.dest_name, args);
        update_display();
        update_connection_properties_for(args, view.get_selected_connections(model.connections));
    });
    command.register("mod_connection", function(cmd, args) {
        model.connections.add(args.src_name + '>' + args.dest_name, args);
        update_display();
        update_connection_properties_for(args, view.get_selected_connections(model.connections));
    });
    command.register("del_connection", function(cmd, args) {
        var conns = view.get_selected_connections(model.connections);
        model.connections.remove(args.src_name+'>'+args.dest_name);
        update_display();
        update_connection_properties_for(args, conns);
    });

    command.register("set_network", function(cmd, args) {
        model.networkInterfaces.selected = args;
        refresh_all();
    });

    command.register("active_network", function(cmd, args) {
        model.networkInterfaces.selected = args;
    });
    
    // actions from VIEW

    $("#container").on("tab", function(e, selectedTab){
    	command.send('tab', selectedTab);
    });
    
    $("#container").on("getSignalsByDevice", function(e, deviceName){
        command.send('get_signals_by_device_name', deviceName);
    });
    
    $("#container").on("link", function(e, src, dst){
        command.send('link', [src, dst]);
    });
    $("#container").on("unlink", function(e, src, dst){
        command.send('unlink', [src, dst]);
    });
    $("#container").on("connect", function(e, src, dst){
        command.send('connect', [src, dst]);
    });
    $("#container").on("disconnect", function(e, src, dst){
        command.send('disconnect', [src, dst]);
    });
    
    $('#container').css('height', 'calc(100% - ' + ($('.topMenu').height() + 5) + 'px)' );
    window.onresize = function (e) {
    	$('#container').css('height', 'calc(100% - ' + ($('.topMenu').height() + 5) + 'px)' );
    	view.on_resize();
    };
    
    // Delay starting polling, because it results in a spinning wait
    // cursor in the browser.
    setTimeout(
        function(){
        	switch_mode('list');
            command.start();
            command.send('get_networks');
            command.send('all_devices');
            command.send('all_signals');
            command.send('all_links');
            command.send('all_connections');
            add_handlers();
        }, 100);

}

function add_container_elements()
{
    $('body').append(
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
	    "</div>"+
	    "<div id='container'></div>"
    );

    $('body').attr('oncontextmenu',"return false;");
}

function add_signal_control_bar() 
{
    //Add the mode controls
    $('.topMenu').append("<div class='modesDiv signalControl disabled'></div>");
    for (var m in connectionModesDisplayOrder) {
        $('.modesDiv').append(
            "<div class='mode mode"+connectionModesDisplayOrder[m]+"'>"+connectionModesDisplayOrder[m]+"</div>");
    }

    $('.modesDiv').append("<input type='text' size=25 class='expression'></input>");

    //Add the range controls
    $('.topMenu').append(
        "<div id='srcRange' class='range signalControl disabled'>Src Range:</div>"+
        "<div id='destRange' class='range signalControl disabled'>Dest Range:</div>");
    $('.range').append("<input><input>");
    $('.range').children('input').each( function(i) {
        var minOrMax = 'Max'   // A variable storing minimum or maximum
        var srcOrDest = 'Src'
        if(i%2==0)  minOrMax = 'Min';
        if(i>1)     srcOrDest = 'Dest';
        $(this).attr({
            'maxLength': 15,
            "size": 5,
            // Previously this was stored as 'rangeMin' or 'rangeMax'
            'class': 'range',   
            'id': 'range'+srcOrDest+minOrMax,
            'index': i
        })
    });

    $("<input id='boundaryMin' class='boundary boundaryDown' type='button'></input>").insertBefore('#rangeDestMin');
    $("<input id='boundaryMax' class='boundary boundaryUp' type='button'></input>").insertAfter('#rangeDestMax');

}

function add_extra_tools()
{
    $('.topMenu').append(
        "<div id='wsstatus' class='extratools'>websocket uninitialized</div>"+
        "<div id='refresh' class='extratools'>");
}


function network_selection()
{
    var menuOpen = false; // A variable storing the state of network selection

    $('body').on('mousedown', function(e) {
        if(e.which == 3) {              // A right click
            if(menuOpen) cleanup();     // Removes the menu and handlers if already open (multiple right clicks)
            select_network(e);
        }
    });

    function select_network(clickEvent) {
        command.send('get_networks');
        command.register('available_networks', function(cmd, args){
            model.networkInterfaces.available = args;
            $(  "<div id='networkMenu'>"+
                    "<table>"+
                        "Current Network: "+model.networkInterfaces.selected+
                        "<thead><th>Available Networks</th></thead>"+
                        "<tbody></tbody>"+
                    "</table></div>"
                ).insertAfter('#container');
            $('#networkMenu').css({'top': clickEvent.pageY, 'left': clickEvent.pageX});
            menuOpen = true;

            for (var i in model.networkInterfaces.available ) {
                $('#networkMenu tbody').append('<tr><td>'+model.networkInterfaces.available[i]+'</td></tr>');
            }

            $('#networkMenu td').on('click.networkSelect', function(e) {
                e.stopPropagation();
                command.send('select_network', $(this).text() );
                cleanup();
            });

            $('body').on('click.networkSelect', function(e) {cleanup()} );
        });
    }

    function cleanup() {
        $('#networkMenu').fadeOut(100).remove();
        $('*').off('.networkSelect');
        menuOpen = false;
        command.unregister('available_networks');
    }
}

/**
 * handlers for items in the top menu 
 */
function add_handlers()
{
    //The expression and range input handlers
    $('.topMenu').on({
        keydown: function(e) {
            e.stopPropagation();
            if(e.which == 13) //'enter' key
                selected_connection_set_input( $(this).attr('class').split(' ')[0], this, $(this).attr('index') );
        },
        click: function(e) { e.stopPropagation(); },
        blur: function() {selected_connection_set_input( $(this).attr('class').split(' ')[0], this, $(this).attr('index') );}
    }, 'input');

    //For the mode buttons
    $('.topMenu').on("click", '.mode', function(e) {
        e.stopPropagation();
        selected_connection_set_mode(e.currentTarget.innerHTML);
    });

    //For the visualization mode selection menu
    $('#modeSelection').change( function(e) {
        var newMode = $('#modeSelection').val();
        switch_mode(newMode);
    });

    $('#saveButton').on('click', function(e) {
        e.stopPropagation();
    });

    $('#loadButton').click(function(e) {
        e.stopPropagation();
        on_load();
    });

    $('.boundary').on('click', function(e) {
        on_boundary(e);
    });

    $('body').on('keydown', function(e) {
        if( e.which == 77 ) mute_selected();
    });

    $('#refresh').on('click', function(e) { 
        $(this).css({'-webkit-animation': 'refreshSpin 1s'});
        refresh_all(); 
        setTimeout(function(){
            $('#refresh').css({'-webkit-animation': ''});
        }, 1000);
    });

    $('body').on('keydown', function(e){
        if(e.which == 8  && !$(':focus').is('input')) // 'delete' key, don't want the browser to go back in history
            e.preventDefault();
    });

    network_selection();

}



