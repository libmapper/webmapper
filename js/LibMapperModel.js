function LibMapperModel ()
{
	this.devices = new Assoc();
	this.signals = new Assoc();
	this.links = new Assoc();
	this.connections = new Assoc();
	
	this.selectedConnections = new Assoc();
	

	this.networkInterfaces = {'selected': null, 'available': []};		
	
	// config items
	this.pathToImages = "images/";
};

LibMapperModel.prototype = {
		
		selectedConnections_addConnection : function (src, dst)
		{
			var key = src + ">" + dst;
			var conn = this.connections.get(key);
			if(conn){
				if(!this.selectedConnections.get(key)){
					this.selectedConnections.add(key, conn);
				}
			}	
		},

		selectedConnections_removeConnection : function (src, dst){
			var key = src + ">" + dst;
			if(this.selectedConnections.get(key))
			{
				this.selectedConnections.remove(key);
			}
		},
		
		selectedConnections_isSelected : function (src, dst)
		{
			var key = src + ">" + dst;
			var conn = this.selectedConnections.get(key);
			if(conn)
				return true;
			else
				return false;
		},
		selectedConnections_clearAll : function (src, dst)
		{
			this.selectedConnections = new Assoc();
		},
		
		getConnection : function (src, dst)
		{
			var key = src + ">" + dst;
			return this.connections.get(key);
		},
		
		isConnected : function (src, dst)
		{
			var conn = this.getConnection(src, dst);
			if(conn)
				return true;
			return false;
		},
		
		getLink : function (src, dst)
		{
			var key = src + ">" + dst;
			return this.links.get(key);
		},
		
		isLinked : function (src, dst)
		{
			var link = this.getLink(src, dst);
			if(link)
				return true;
			return false;
		},
		
		// returns devices split into sources and destinations
		getDevices : function()
		{
			var srcDevs = new Array();
			var dstDevs = new Array();
			
			var keys = this.devices.keys();
			for (var d in keys) 
			{
				var k = keys[d];
				var dev = this.devices.get(k);
				
				if (dev.n_outputs)
					srcDevs.push(dev);
				if (dev.n_inputs)
					dstDevs.push(dev);
			}
			
			return [srcDevs, dstDevs];
		}
		
};