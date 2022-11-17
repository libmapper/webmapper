class SignalMonitor {
    constructor(viewManager, sigName) {
        // If curve editor is open, return
        if ($('#signalMonitorWindow').length) {
            return;
        }
        console.log(sigName);
        command.send('monitor_sig', sigName);

        let body = $('body');
        $(body).append("<div id='signalMonitorWindow' style='position:absolute;left:calc(50% - 30vh);top:25%;background:#494949;width:60vh;height:50vh;display:flex;flex-direction:column;justify-content:center;align-items:center;border-radius:12px;'></div>");
        $('#signalMonitorWindow').append("<div id='signalMonitor' style='position:relative;display:flex;justify-content:center;align-items:center;'></div");

        var canvas = Raphael($('#signalMonitor')[0], '100%', '40vh');
        canvas.setViewBox(0, 0, 120, 120);
        canvas.canvas.id = 'signalSVG';
        canvas.canvas.preserveAspectRatio.baseVal.align = 6;

        // Axes
        let box = canvas.rect(10, 10, 100, 100, 2).attr({'stroke': '#FFF', 'stroke-width': 1});

        // Axis labels
        const reso = 20;
        canvas.text(7, 10, reso).attr({'font-size': 5, 'text-anchor': 'end', 'fill': '#FFF'});
        canvas.text(7, 105, 0).attr({'font-size': 5, 'text-anchor': 'end', 'fill': '#FFF'});
        canvas.text(15, 115, 0).attr({'font-size': 5, 'fill': '#FFF'});
        canvas.text(110, 115, reso).attr({'font-size': 5, 'fill': '#FFF'});

        function update() {
            
        };

        $('#signalMonitor svg').css('overflow', 'visible');
    
        let points = [];
        for (let i = 0; i <= reso; i++) {
            let x = i / reso;
            let y = i / reso;
            x = 10.0 + x * 100.0;
            y = 110.0 - y * 100.0;
            let circ = canvas.circle(x, y, 1).attr({'fill': '#FFF', 'stroke': '#FFF'});
            points.push(circ);
        }

        // Generate button
        $('#signalMonitorWindow').append("<div id='curveExprDisplay' style='width:90%;text-align:center;color:white;height:3em'>"+sigName+"</div>"
                                       +"<div style='width:70%'>"
                                       +"<div id='signalMonitorClose' class='button sel' style='width:45%;text-align:center;color:white;'>Close</div></div>");
        $('#signalMonitorClose').click(function(e) {
            e.stopPropagation();
            e.preventDefault();
            $('#signalMonitorWindow').remove();
            command.send('stop_monitor_sig');
        });
        $('#signalMonitorWindow').on('click', function(e) {
            e.stopPropagation();
        });
        $(body).one('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            $('#signalMonitorWindow').remove();
            command.send('stop_monitor_sig');
        });

        command.unregister("update_sig_monitor");

        command.register("update_sig_monitor", this.update.bind(this));
    }
}
