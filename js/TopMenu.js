function TopMenu(container, model) {
    this._container = container;
    this.model = model;
    this.connectionModeCommands = {"Linear": 'linear', "Expression": 'expression' };
    this.connectionModes = ["Linear", "Expression"];
    this.boundaryModes = ["None", "Mute", "Clamp", "Fold", "Wrap"];
    this.boundaryIcons = ["boundaryNone", "boundaryUp", "boundaryDown",
                          "boundaryMute", "boundaryClamp", "boundaryWrap"];
}

TopMenu.prototype = {
    // Initialize the Top Menu Bar Component
    init : function() {
        var _self = this;   // to pass to context of THIS to event handlers

        $(this._container).empty();        // clear the container DIV

        window.saveLocation = '';        // Where the network will be saved

        $(this._container).append(
            "<div class='topMenu'>"+
                "<div class='utils'>"+
                    "<div id='refresh'></div>"+
                    "<div id='saveLoadDiv'>"+
                        "<div><a id='loadButton'>Load</a></div>"+
                        "<div><a id='saveButton'>Save</a></div>"+
                    "</div>"+
                    "<div>Display: <select id='modeSelection'>"+
                        "<option value='list' selected>List</option>"+
                        "<option value='grid'>Grid</option>"+
                        "<option value='hive'>Hive</option>"+
                        "<option value='balloon'>Balloon</option></select>"+
                    "</div>"+
                "</div>"+
            "</div>");

        //Add the mode controls
        $('.topMenu').append("<div class='signalProps'>"+
                     "<div class='modesDiv signalControl disabled' style='width:50%'>Mode: </div>"+
                     "<div class='ranges' style='width:50%'></div>"+
                 "</div>");

        for (var m in this.connectionModes) {
            $('.modesDiv').append(
                "<div class='mode mode"+this.connectionModes[m]+"'>"+this.connectionModes[m]+"</div>");
        }

        $('.modesDiv').append("<div style='width:100%'>Expression: "+
                     "<input type='text' id='expression 'class='expression' style='width:calc(100% - 90px)'></input>"+
                 "</div>");

        //Add the range controls
        $('.ranges').append(
            "<div id='srcRange' class='range signalControl disabled'>"+
                "<div style='width:85px'>Src Range:</div>"+
                "<div style='width:calc(100% - 85px)'>"+
                    "<div style='width:24px'></div>"+
                    "<input class='range' id='src_min' style='width:calc(50% - 34px)'></input>"+
                    "<div id='srcRangeSwitch' class='rangeSwitch'></div>"+
                    "<input class='range' id='src_max' style='width:calc(50% - 34px)'></input>"+
                    "<div style='width:24px'></div>"+
                "</div>"+
            "</div>"+
            "<div id='dstRange' class='range signalControl disabled'>"+
                "<div style='width:85px'>Dest Range:</div>"+
                "<div style='width:calc(100% - 85px)'>"+
                    "<div id='boundaryMin' class='boundary boundaryDown' type='button'></div>"+
                    "<input class='range' id='dst_min' style='width:calc(50% - 34px)'></input>"+
                    "<div id='dstRangeSwitch' class='rangeSwitch'></div>"+
                    "<input class='range' id='dst_max' style='width:calc(50% - 34px)'></input>"+
                    "<div id='boundaryMax' class='boundary boundaryUp' type='button'></div>"+
                "</div>"+
            "</div>");

        // extra tools
        $('.topMenu').append(
            "<div id='wsstatus' class='extratools'>websocket uninitialized</div>");

        this.addHandlers();
    },

    addHandlers : function() {
        var _self = this;

        //The expression and range input handlers
        $('.topMenu').on({
            keydown: function(e) {
                e.stopPropagation();
                if (e.which == 13) { //'enter' key
                    _self.selected_connection_set_input($(this).attr('id').split(' ')[0], this);
                }
            },
            click: function(e) { e.stopPropagation(); },
            blur: function() {_self.selected_connection_set_input($(this).attr('id').split(' ')[0], this);}
        }, 'input');

        //For the mode buttons
        $('.topMenu').on("click", '.mode', function(e) {
            e.stopPropagation();
            _self.selected_connection_set_mode(e.currentTarget.innerHTML);
        });

        //For the visualization mode selection menu
        $('#modeSelection').change(function(e) {
            var newMode = $('#modeSelection').val();
            $(_self._container).trigger("switchView", [newMode]);    // trigger switch event
        });

        $('#saveButton').on('click', function(e) {
            e.stopPropagation();
        });

        $('#loadButton').click(function(e) {
            e.stopPropagation();
            _self.on_load();
        });

        $('.boundary').on('click', function(e) {
            _self.on_boundary(e, _self);
        });

        $('.rangeSwitch').click(function(e) {
            e.stopPropagation();
            _self.selected_connection_switch_range(e.currentTarget.id=='srcRangeSwitch',
                                                   e.currentTarget);
        });

        $('body').on('keydown', function(e) {
            if (e.which == 77)
                _self.mute_selected();
        });

        $('#refresh').on('click', function(e) {
            $(this).css({'-webkit-animation': 'refreshSpin 1s'});
            $(this._container).trigger("refreshAll");
            setTimeout(function() {
                $('#refresh').css({'-webkit-animation': ''});
            }, 1000);
        });
    },

    //clears and disables to connection properties bar
    clearConnectionProperties : function() {
        $(".mode").removeClass("modesel");
        $("*").removeClass('waiting');
        $(".topMenu input").val('');
        $('.boundary').removeAttr('class').addClass('boundary boundaryNone');
        $('.signalControl').children('*').removeClass('disabled');
        $('.signalControl').addClass('disabled');
    },

    // conn object with arguments for the connection
    updateConnectionPropertiesFor : function(conn) {
        var conns = this.model.selectedConnections;

        if (conns.length() == 1) {
            if (conns[0].src == conn.src
                && conns[0].dst == conn.dst) {
                this.updateConnectionProperties(conns);
            }
        }
    },

    updateConnectionProperties : function() {
        this.clearConnectionProperties();

        var maps = this.model.selectedConnections;

        if (maps.length() == 0)
            return;

        var mode = null;
        var expression = null;
        var src_min = null;
        var src_max = null;
        var dst_min = null;
        var dst_max = null;
        var src_calibrating = false;
        var dst_calibrating = false;
        var dst_bound_min = 'none';
        var dst_bound_max = 'none';

        $('.signalControl').removeClass('disabled');
        $('.signalControl').children('*').removeClass('disabled');

        for (var i in maps.contents) {
            var m = maps.contents[i];

            if (mode == null)
                mode = m.mode;
            else if (mode != m.mode)
                mode = 'multiple'

            if (expression == null)
                expression = m.expression;
            else if (expression != m.expression)
                expression = 'multiple';

            if (src_min == null)
                src_min = m.src_min;
            else if (src_min != m.src_min)
                src_min = 'multiple';
            if (src_max == null)
                src_max = m.src_max;
            else if (src_max != m.src_max)
                src_max = 'multiple';
            if (dst_min == null)
                dst_min = m.dst_min;
            else if (dst_min != m.dst_min)
                dst_min = 'multiple';
            if (dst_max == null)
                dst_max = m.dst_max;
            else if (dst_max != m.dst_max)
                dst_max = 'multiple';

            if (dst_bound_min == null)
                dst_bound_min = m.bound_min;
            else if (dst_bound_min != m.bound_min)
                dst_bound_min = 'multiple';
            if (dst_bound_max == null)
                dst_bound_max = m.bound_max;
            else if (dst_bound_max != m.bound_max)
                dst_bound_max = 'multiple';
        }

        if (mode != null && mode != 'multiple') {
            // capitalize first letter of mode
            mode = mode.charAt(0).toUpperCase() + mode.slice(1);
            $(".mode"+mode).addClass("modesel");
        }

        if (expression != null && expression != 'multiple')
            $(".expression").val(expression);

        if (src_min != null && src_min != 'multiple')
            $("#src_min").val(src_min);
        if (src_max != null && src_max != 'multiple')
            $("#src_max").val(src_max);
        if (dst_min != null && dst_min != 'multiple')
            $("#dst_min").val(dst_min);
        if (dst_max != null && dst_max != 'multiple')
            $("#dst_max").val(dst_max);

        if (dst_bound_min != null)
            this.set_boundary($("#boundaryMin"), dst_bound_min, 0);
        if (dst_bound_max != null)
            this.set_boundary($("#boundaryMax"), dst_bound_max, 1);
    },

    selected_connection_set_input : function(what, field) {
        if (what == 'srcRangeSwitch' || what == 'dstRangeSwitch')
            return;
        var conns = this.model.selectedConnections;
        if (!conns.length())
            return;

        for (var i in conns) {
            if (conns[i][what] == field.value || conns[i][what] == parseFloat(field.value))
                continue;
            var msg = {};

            // copy src and dst names
            msg['src'] = conns[i]['src'];
            msg['dst'] = conns[i]['dst'];

            // set the property being modified
            if (what == 'mode')
                msg[what] = connectionModeCommands[connectionModes[conns[i][what]]];
            else
                msg[what] = field.value;

            // is expression is edited, switch to expression mode
            if (what == 'expression' && conns[i]['mode'] != 'Expr')
                msg['mode'] = 'expression';

            // send the command, should receive a /connection/modify message after.
            $(this._container).trigger("setConnection", [msg]);

            $(field).addClass('waiting');
        }
    },

    selected_connection_set_mode : function(modestring) {
        var modecmd = this.connectionModeCommands[modestring];
        if (!modecmd) return;

        var conns = this.model.selectedConnections();
        if (!conns.length()) return;

        var msg = {'mode' : modecmd};

        for (var i in conns) {
            if (conns[i]['mode'] == modestring)
                continue;
            msg['src'] = conns[i]['src'];
            msg['dst'] = conns[i]['dst'];
            $(this._container).trigger("setConnection", [msg]);    // trigger switch event
        }
    },

    copy_selected_connection : function() {
        var conns = this.model.selectedConnections();
        if (conns.length() != 1) return;
        var args = {};

        // copy existing connection properties
        for (var c in conns[0]) {
            args[c] = conns[0][c];
        }
        return args;
    },

    on_load : function() {
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

        iframe.onload = function() {
//            var t = $(iframe.contentDocument.body).text();
//            if (t.search('Success:') == -1 && t.search('Error:') == -1)
//                return;
            _self.notify($(iframe.contentDocument.body).text());
            $(l).remove();
            body.removeChild(iframe);
        };

        $('#cancel', form).click(function() {
            $(l).remove();
            $('#container').removeClass('onLoad');
            body.removeChild(iframe);
        });

        form.firstChild.onchange = function() {

            var fn = document.createElement('input');
            fn.type = 'hidden';
            fn.name = 'filename';
            fn.value = form.firstChild.value;
            form.appendChild(fn);

            // The devices currently in focused
            var devs = view.get_focused_devices();
            // Split them into sources and destinations
            var srcdevs = [];
            var dstdevs = [];
            for (var i in devs.contents) {
                if (devs.contents[i].num_outputs)
                    srcdevs.push(devs.contents[i].name);
                if (devs.contents[i].num_inputs)
                    dstdevs.push(devs.contents[i].name);
            }

            //So that the monitor can see which devices are being looked at
            var srcs = document.createElement('input');
            srcs.type = 'hidden';
            srcs.name = 'sources';
            srcs.value = srcdevs.join();
            form.appendChild(srcs);

            var dsts = document.createElement('input');
            dsts.type = 'hidden';
            dsts.name = 'destinations';
            dsts.value = dstdevs.join();
            form.appendChild(dsts);

            form.submit();
        };
        return false;
    },

    selected_connection_switch_range : function(is_src, div) {
         var c = this.copy_selected_connection();
         if (!c) return;

         var msg = {};
         if (is_src) {
             msg['src_max'] = String(c['src_min']);
             msg['src_min'] = String(c['src_max']);
         }
         else {
             msg['dst_max'] = String(c['dst_min']);
             msg['dst_min'] = String(c['dst_max']);
         }
         msg['src'] = c['src'];
         msg['dst'] = c['dst'];
         $(this._container).trigger("setConnection", msg);
    },

    on_boundary : function(e, _self) {
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

        _self.selected_connection_set_boundary(b,
            e.currentTarget.id == 'boundaryMax', e.currentTarget);

        e.stopPropagation();
    },

    selected_connection_set_boundary : function(boundarymode, ismax, div) {
        var args = this.copy_selected_connection();

        if (!args)
            return;

        // TODO: this is a bit out of hand, need to simplify the mode
        // strings and indexes.
        var modecmd = this.connectionModeCommands[this.connectionModes[args['mode']]];
        args['mode'] = modecmd;

        var c = ismax ? 'bound_max' : 'bound_min';
        args[c] = boundarymode;

        // send the command, should receive a /connection/modify message after.
        $(this._container).trigger("setConnection", [args]);

        // Do not set the background color, since background is used to
        // display icon.  Enable this if a better style decision is made.
        //$(div).addClass('waiting');
    },

    notify : function(msg) {
        var li = document.createElement('li');
        li.className = 'notification';
        li.innerHTML = msg;
        $('.topMenu').append(li);
        setTimeout(function() {
            $(li).fadeOut('slow', function() { $(li).remove();});
        }, 5000);
    },

    set_boundary : function (boundaryElement, value, ismax) {
        for (var i in this.boundaryIcons)
            boundaryElement.removeClass(this.boundaryIcons[i]);

        if (value == 0) { //'None' special case, icon depends on direction
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

    mute_selected : function() {
        var conns = this.model.selectedConnections;

        for (var i in conns) {
            var c = conns[i];
            var msg = {};
            msg['src'] = c['src'];
            msg['dst'] = c['dst'];
            msg['muted'] = !c.muted;

//            // TODO: why modes aren't just stored as their strings, I don't know
//            var modecmd = this.connectionModeCommands[this.connectionModes[args['mode']]];
//            args['mode'] = modecmd;

            $(this._container).trigger("setConnection", msg);
        }
    },

    /**
     * Updates the save/loading functions based on the view's state
     * currently set up for the list view only
     */
    updateSaveLocation : function(location) {
        // get the save location
        if (location) {
            window.saveLocation = location;
        }
        else {
            window.saveLocation = '';
        }

        // update the save button's link
        $('#saveButton').attr('href', window.saveLocation);

        // if saving is not ready, disable the save button
        if (window.saveLocation == '') {
            $('#saveButton, #loadButton').addClass('disabled');
        }
        // if saving is ready, enable the save button
        else {
            $('#saveButton, #loadButton').removeClass('disabled');
        }
    }
};








