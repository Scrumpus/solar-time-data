angular.module('rfApp', [])
.controller('solarCtrl', ['$scope', 'DateService', 'GetSunriseSunset', 'ErrorService', 'LoadingService',
function($scope, DateService, GetSunriseSunset, ErrorService, LoadingService) {
	$scope.dateRange = [];
	$scope.rows = [];
	$scope.address = '';
	$scope.order = 'Ascending';
	$scope.reverse = false;
	$scope.errorMessage = '';

	var currDate = new Date;
	var lastWeek = new Date;
	lastWeek.setDate(lastWeek.getDate() - 7);
	$scope.startDate = DateService.mmDDYYYY(lastWeek);
	$scope.endDate = DateService.mmDDYYYY(currDate);

	$scope.lastOffset = 0;

	//change data according to time zone
	$scope.updateTimezone = function() {
		var offset = parseInt($scope.timezoneOffset) - parseInt($scope.lastOffset);
		$scope.rows.forEach(function(row) {
			Object.keys(row.solarData).map(function(value) {
				if (value !== 'day_length' && value !=='rf_nautical_afternoon') {
						row.solarData[value] = DateService.timeWithOffset(row.solarData[value], offset);
				}
			})
		})
		$scope.lastOffset = $scope.timezoneOffset;
	}

	//fetch data from apis and create array of data for each date
	$scope.submit = function(form) {
		ErrorService.clearMessage($scope);
		form.$setSubmitted();
		if (form.$invalid) return;
		LoadingService.setLoading($scope);
		$scope.rows = [];
		$scope.loadingDate = $scope.startDate;
		$scope.dateRange = DateService.dateRangeArray($scope.startDate, $scope.endDate);

		var numDates = $scope.dateRange.length;

		var i = 0;

		GetSunriseSunset($scope, $scope.address, $scope.dateRange, function(date, solarData) {
			solarData.rf_nautical_afternoon = DateService.timeDifference(solarData.solar_noon,
																		 solarData.nautical_twilight_end);
			if ($scope.timezoneOffset) {
				Object.keys(solarData).map(function(value) {
					if (value !== 'day_length' && value !== 'rf_nautical_afternoon') {
						solarData[value] = DateService.timeWithOffset(solarData[value], $scope.timezoneOffset);
					}
				})
				$scope.lastOffset = $scope.timezoneOffset;
			}
			$scope.rows.push({
				date: date,
				solarData: solarData
			});
			i++;
			if (i == numDates) {
				LoadingService.doneLoading($scope);
				$scope.rows.sort(function(a,b) {
					if (b.date < a.date) return 1;
					return -1;
				})
			}	
			$scope.loadingDate = date;
		});
	}

	//change order in which dates are displayed
	$scope.reverseOrder = function() {
		$scope.reverse = !$scope.reverse;
		if ($scope.order == 'Ascending') {
			$scope.order = 'Descending';
		}
		else $scope.order = 'Ascending';
	}

	//overlay functions
	$scope.selectRow = function(row, index) {
		$scope.selectedRow = row;
		$scope.selectedRowIndex = index;
	}

	$scope.rowRight = function() {
		$scope.selectedRowIndex = ($scope.selectedRowIndex+1)%$scope.rows.length;
		$scope.selectedRow = $scope.rows[$scope.selectedRowIndex];
	}

	$scope.rowLeft = function() {
		var numRows = $scope.rows.length;
		$scope.selectedRowIndex = ($scope.selectedRowIndex + numRows - 1)%numRows;
		$scope.selectedRow = $scope.rows[$scope.selectedRowIndex];
	}

	$scope.overlayClose=function(event) {
		var overlay = document.getElementById('overlay');
		if (event.target == overlay) {
			$scope.selectedRow = '';
		}
	}
}])

/*
 * Keep track of loading
 */
.service('LoadingService', function() {

	this.setLoading = function(scope) {
		scope.loading = true;
		scope.loaded = false;
	}

	this.doneLoading = function(scope) {
		scope.loading = false;
		scope.loaded = true;
	}
})


/*
 * Date parsing/manipulating
 */
.service('DateService', function() {

	//get date in mm/dd/yyyy format
	this.mmDDYYYY = function(date) {
		var day = date.getDate();
		var month = date.getMonth() + 1;
		var year = 1900 + date.getYear();

		if (month < 10) month = "0" + month;
		if (day < 10) day = "0" + day;

		return month + '/' + day + '/' + year;
	}

	//get time with timezone offset
	this.timeWithOffset = function(time, offset) {
		offset = parseInt(offset);
		var hms = time.split(' ')[0].split(':');
		var hour = parseInt(hms[0]);
		var meridiem = time.split(' ')[1];
		if (hour == 12 && meridiem == 'AM') hour = 0;
		if (hour < 12 && meridiem == 'PM') hour += 12;
		var newHour = hour + offset;
		if (newHour < 0) newHour += 24;
		if (newHour >= 24) newHour -= 24;
		if (newHour < 12 && newHour >= 0) {
			if (newHour == 0) newHour = 12;
			meridiem = 'AM';
		}
		else {
			if (newHour > 12) newHour -= 12;
			meridiem = 'PM';
		}
		if (newHour < 10) newHour = '0' + newHour;
		
		
		return newHour + ':' + hms[1] + ':' + hms[2] + ' ' + meridiem;

		function changeMeridiem(meridiem) {
			if (meridiem == 'AM') return 'PM';
			return 'AM';
		}
	}

	//get array of dates with a range
	this.dateRangeArray = function(start, end) {
		var dates = [];
		var startDate = new Date(start);
		var endDate = new Date(end);

		for (var d = startDate; d <= endDate; d.setDate(d.getDate()+1)) {
			dates.push(this.mmDDYYYY(d));
		}

		return dates;
	}

	//get time difference between two times in format hh:mm:ss AM/PM
	this.timeDifference = function(start, end) {
		var endDate = new Date('01/01/2015 ' + end);
		var startDate = new Date('01/01/2015 ' + start);

		if (endDate < startDate) {
			endDate.setDate(endDate.getDate()+1);
		}

		var msDiff = endDate - startDate;

		var seconds = parseInt((msDiff/1000)%60),
			minutes = parseInt((msDiff/(1000*60))%60),
			hours = parseInt((msDiff/(1000*60*60))%24);

		if (hours < 10) hours = '0' + hours;
		if (minutes < 10) minutes = '0' + minutes;
		if (seconds < 10) seconds = '0' + seconds;

		return hours + ":" + minutes + ":" + seconds;
	}
})

/*
 * service for error messages
 */
.service('ErrorService', [function() {
	this.setMessage = function(scope, message) {
		scope.errorMessage = message;
		scope.loading = false;
		scope.loaded = false;
	}
	this.clearMessage = function(scope) {
		scope.errorMessage = '';
	}
}])


/*
 * Get the solar data of an address for each date in a date range
 */
.factory('GetSunriseSunset', ['$http', 'ErrorService', function($http, ErrorService) {
	return function(scope, address, dateRange, callback) {

		// get latitude and longitude of address
		$http({
			url: 'https://maps.googleapis.com/maps/api/geocode/json',
			method: 'GET',
			params: {
				address: address
			}
		})

		.error(function(data) {
			console.log(data);
			return;
		})

		//get solar data for each date
		.success(function(data) {

			//handle status message
			switch(data.status) {
				case "OK":
					break;
				default:
					ErrorService.setMessage(scope, 'Error finding coordinates for ' + address);
					return;
			}

			
			var location = data.results[0].geometry.location;
			var latitude = location.lat;
			var longitude = location.lng;
			angular.forEach(dateRange, function(date) {
				$http({
					url: 'http://api.sunrise-sunset.org/json',
					method: 'GET',
					params: {
						lat: latitude,
						lng: longitude,
						date: date
					}
				})

				.success(function(data) {

					//handle status messages
					switch(data.status) {
						case "OK":
							break;
						default:
							ErrorService.setMessage(scope, "Error finding solar data for " + date);
							return;
					}
					//execute a callback function, if provided
					if (callback) callback(date, data.results);
				})
				.error(function(data) {
					return;
				})
			})
		})
	}
}])


/*
 * directive to ensure that the start date does not exceed the end date
 */
.directive('stMax', function() {
	function dateLessThan(start, end) {
		return new Date(start) <= new Date(end);
	}
	return {
		restrict: 'A',
		require: 'ngModel',
		link: function(scope, element, attrs, ngModel) {			

			//watch changes in the end date
			scope.$watch('endDate', function(newEnd) {
				ngModel.$setValidity('stMax', dateLessThan(scope.startDate, newEnd));
			});

			//check when the start date changes
	        ngModel.$parsers.unshift(function(value) {
	            ngModel.$setValidity('stMax', dateLessThan(value, attrs.stMax));
	            return value;
	        });
		}
	}
})
