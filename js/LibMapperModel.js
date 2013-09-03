function LibMapperModel ()
{
	this.devices = new Assoc();
	this.signals = new Assoc();
	this.links = new Assoc();
	this.connections = new Assoc();

	this.networkInterfaces = {'selected': null, 'available': []};		
};

LibMapperModel.prototype = {
		
		isConnected : function (src, dst)
		{
			var conn = this.getConnection(src, dst);
			if(conn)
				return true;
			return false;
		},
		getConnection : function (src, dst)
		{
			var key = src + ">" + dst;
			return this.connections.get(key);
		},
		isLinked : function (src, dst)
		{
			var link = this.getLink(src, dst);
			if(link)
				return true;
			return false;
		},
		getLink : function (src, dst)
		{
			var key = src + ">" + dst;
			return this.links.get(key);
		}
};