String.prototype.toTitleCase  = function(){                                                                                                                               
	var str = this.toString().toLowerCase();                                                                                                                              
	return str.replace(/\b(\w)/g, function(x){return x.toUpperCase();});                                                                                                  
};  
