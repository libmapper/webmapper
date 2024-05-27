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
        const bufSize = 20;

        $('#signalMonitor svg').css('overflow', 'visible');
    
        let points = [];
        let values = [];
        let curIdx = 0; // index of most recent value
        for (let i = 0; i < bufSize; i++) {
            let x = i / bufSize;
            let y = 0.0;
            x = 10.0 + x * 100.0;
            y = 110.0 - y * 100.0;
            let circ = canvas.circle(x, y, 1).attr({'fill': '#FFF', 'stroke': '#FFF'});
            points.push(circ);
            values.push(0);
        }
        let curMin = 0;
        let curMax = 1;
        let updateRanges = false;
        let xLabelMin = canvas.text(15, 115, 'n-20').attr({'font-size': 5, 'fill': '#FFF'});
        let xLabelMax = canvas.text(110, 115, 'n').attr({'font-size': 5, 'fill': '#FFF'});
        let yLabelMax = canvas.text(7, 10, curMax).attr({'font-size': 5, 'text-anchor': 'end', 'fill': '#FFF'});
        let yLabelMin = canvas.text(7, 105, curMin).attr({'font-size': 5, 'text-anchor': 'end', 'fill': '#FFF'});

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

        command.register("update_sig_monitor", function(cmd, curValue) {
            // Update min and max
            if (curValue < curMin) {
                curMin = curValue;
                updateRanges = true;
            } else if (curValue > curMax) {
                curMax = curValue;
                updateRanges = true;
            }
            if (updateRanges) {
                yLabelMin.attr('text', curMin);
                yLabelMax.attr('text', curMax);
                updateRanges = false;
            }
            curIdx = (curIdx + 1) % bufSize; // Increment current index
            values[curIdx] = curValue;
            let newMin = curValue;
            let newMax = curValue;
            for (let i = 0; i < bufSize; i++) {
                let value = values[(i + curIdx + 1) % bufSize];
                if (value > newMax) {
                    newMax = value;
                    updateRanges = true;
                }
                else if (value < newMin) {
                    newMin = value;
                    updateRanges = true;
                }
                let y = normalize(value, curMin, curMax);
                y = 110.0 - y * 100.0;
                points[i].attr('cy', y);
            }
            curMin = newMin;
            curMax = newMax;
        });

        function normalize(val, min, max) { return (val - min) / (max - min); }
    }
}
