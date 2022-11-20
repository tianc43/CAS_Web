angular.module('cg', [ 'ui.router', 'ngAnimate', 'angles'])
/**
 * Define the configuration for the commit guru application
 */
.config(function($stateProvider, $locationProvider, $urlRouterProvider) {

	$stateProvider.state('home', {
		url: '/',
		templateUrl: '/ui/home/index.html',
		controller: 'HomeController',
		resolve: {
			status: function() {
				return {statusCode: 200};
			}
		}
	}).state('home.404', {
		url: '404',
		templateUrl: '/ui/home/index.html',
		controller: 'HomeController',
		onEnter: function(status) {
			status.statusCode = 404;
		}	
	}).state('about', {
		url: '/about',
		templateUrl: '/ui/home/about.html',
		controller: function() {},
	}).state('repos', {
		url: '/repos',
		templateUrl: '/ui/repository/index.html'
	}).state('repo', {
		abstract: true,
		url: '/repo/:name',
		templateUrl: '/ui/repository/find.html',
		controller: 'RepoController',
		resolve: {
			repoData: function($stateParams, repoLoader) {
				return repoLoader($stateParams.name);
			}
		}
	}).state('repo.overview', {
		url: '',
		templateUrl: '/ui/repository/overview.html',
	}).state('repo.commits', {
		url: '/commits?type&page&limit&sort&commit_message&commit_hash&classification&author_email',
		templateUrl: '/ui/repository/commits.html',
		controller: 'RepoCommitsController',
        resolve: {
            commitData: function($stateParams, commitLoader) {
                $stateParams.page = +($stateParams.page) || 1;
                $stateParams.limit = +($stateParams.limit) || 20;
                return commitLoader($stateParams);
            }
        }
	}).state('repo.options', {
		url: '/options',
		templateUrl: '/ui/repository/options.html',
		controller: 'RepoOptionsController'
	});
	$urlRouterProvider.otherwise('/404');
	$locationProvider.html5Mode(true);
});

angular.module('cg').controller('AppController',
	function($scope, $location, $timeout, socket, responseHandler, $state) {
        $scope.pageTitle = "Commit Guru";
		$scope.globalMessages = {
			_messages: [],
			push: function(elm) {
				$scope.globalMessages._messages.push(elm);
				$timeout(function() {
					$scope.globalMessages.shift();
				}, 3000);
			},
			shift: function() {
				if(!$scope.globalMessages._messages[0].hold) {
					$scope.globalMessages._messages.shift();
				}
			},
			remove: function(index) {
				$scope.globalMessages._messages.splice(index, 1);
			},
			count: function() {
				return $scope.globalMessages._messages.length;
			},
			get: function() {
				return $scope.globalMessages._messages;
			}
		};

		$scope.globalUtils = {
			responseHandler: responseHandler($scope)
		};

		socket.get('/data', function(response) {
			$scope.$apply(function() {
				$scope.repositories = response.repositories;
				if(response.user) {
					$scope.user.setUser(response.user);
				}
			});
		});
		$scope.loading = false;
		$scope.$on("$stateChangeStart", function(event, toState, toParams) {
			$scope.loading = true;

            var pageTitle = "Commit Guru";
            
            if(toParams.hasOwnProperty("name")) {
                pageTitle += " - " + toParams.name;
            }
            
            if(toParams.hasOwnProperty("page")) {
                if(toParams.page) {
                    pageTitle += " - page " + toParams.page;
                }
            }
            
            $scope.pageTitle = pageTitle;
		});
		$scope.$on("$stateChangeSuccess", function() {
			$scope.loading = false;
            
            ga('send', 'pageview');
		});
		$scope.$on("$stateChangeError", function(event, toState, toParams, fromState, fromParams, error) {
			$scope.globalMessages.push({
				type: 'danger',
				content: error
			});
			$scope.loading = false;
			$state.go('home');
		});
		
		$scope.user = {
			status: {
				authenticated: false
			},
			object: {},
			setUser: function(user) {
				$scope.user.object = user;
				$scope.user.status.authenticated = true;
			},
			clearUser: function() {
				$scope.user.object = {};
				$scope.user.status.authenticated = false;
			},
			signIn: function() {
				socket.post('/login', {
					email: $scope.user.signInFields.email,
					password: $scope.user.signInFields.password
				}, function(response) {

					$scope.globalUtils.responseHandler(response, function(
						response) {
						
						$scope.globalMessages.push({
							type: 'success',
							content: 'Signed in'
						});
						
						$scope.user.setUser(response.user);
						$scope.user.signInFields.password = '';
					}, "Cannot sign in");
				});
			},
			signOut: function() {
				socket.get('/logout', function(response) {

					$scope.globalUtils.responseHandler(response, function(
						response) {
						
						$scope.globalMessages.push({
							type: 'success',
							content: 'Signed out'
						});
						
						$scope.user.clearUser();
						$scope.user.signInFields.password = '';
					}, "Cannot sign out");
				});
			},
			signInFields: {
				email: '',
				password: ''
			}
		};
	});
angular.module('cg').controller(
	'HomeController',
	function($scope, socket, $location, responseHandler, status) {
		$scope.quickActions = {
			repo_url: '',
			repo_email: $scope.user.status.authenticated?$scope.user.object.email: '',
			listed: true,
			quickAddRepo: function() {
				if($scope.quickAddForm.$valid) {
					socket.post('/repo', {
						url: this.repo_url,
						email: this.repo_email,
						listed: this.listed
					}, function(response) {

						$scope.globalUtils.responseHandler(response, function(
							response) {

							// Repo created successfully, redirect to the repo
							$location.path('/repo/' + response.repo.name);

						}, "Could not create repo");
					});
				}
			},
		};
		
		$scope.createUserFields = {
			email: '',
			password: '',
			submit: function() {
				if($scope.createUser.$valid) {
					socket.post('/user', {
						email: this.email,
						password: this.password
					}, function(response) {

						$scope.globalUtils.responseHandler(response, function(
							response) {
							
							$scope.globalMessages.push({
								type: 'success',
								content: 'Account created!'
							});
							
							$scope.user.setUser(response.user);
							$scope.createUserFields.email = '';
							$scope.createUserFields.password = '';
							// Repo created successfully, redirect to the repo
							//$location.path('/repo/' + response.repo.name);

						}, "Could not create account");
					});
				}
			},
		};

		var now = new Date(Date.now());
		now = now.getHours();
		if(now == 0) {
			$scope.now = "12am";
		} else if(now < 12) {
			$scope.now = now + "am";
		} else if(now == 12) {
			$scope.now = "12pm";
		} else {
			$scope.now = (now - 12) + "pm";
		}
		
		if(status.statusCode == 404) {
			$scope.globalMessages.push({
				type: 'danger',
				content: '404: The page you requested does not exist'
			});
		}

	});
angular.module('cg').controller('NavbarController', function($scope, $location) {
	$scope.currentPage = function(uri) {
		var path = $location.path().split('/');
		return path[1] == uri.substr(1);
	};
	$scope.collapse = 0;
});
angular.module('cg').controller('RepoCommitsController', function($scope, socket, commitData, $stateParams, $location) {
    
    $scope.commits = commitData;
	
    $scope.display = {
    	type: $stateParams.type || 'historical',
    	metricKey: 'median',
        sort: $stateParams.sort || '-time'
    };

    $scope.file_warnings = function(warnings, file){
        return warnings[file].length;
    };

    $scope.new_file_warning = function(warnings, file){
        var warning_count = 0;
        for (var warning in warnings[file]) {
            if (warnings[file][warning].is_new_line) {
                warning_count += 1
            }
        }
        return warning_count;
    };

    $scope.total_warnings = function(warnings){
        var warning_count = 0;
        for (var file in warnings) {
            warning_count += warnings[file].length
        }
        return warning_count;
    };

    $scope.new_warnings = function(warnings){
        var warning_count = 0;
        for (var file in warnings) {
            for (var warning in warnings[file])
                if (warnings[file][warning].is_new_line) {
                    warning_count += 1
                }
            // warning_count += warnings[file].length
        }
        return warning_count;

    };

	var handleCommitSearch = function(newValue, oldValue) {
        
        if(newValue === oldValue) {
            return;
        }
        
		var criteria = angular.extend({}, $scope.search);
        
        criteria.page = ($scope.currentPage == 0)? null : $scope.currentPage + 1;
        criteria.limit = ($scope.pageSize == 20)? null : $scope.pageSize;
        criteria.type = ($scope.display.type == "historical")? null : $scope.display.type;
        criteria.sort = ($scope.display.sort == "-time")? null : $scope.display.sort;
        var criteraCount = 0;
        for(var key in criteria) {
            if(criteria[key] === null || criteria[key] === "") {
                delete criteria[key];
            } else if(key != 'page' && key != 'limit') {
                criteraCount++;
                criteria[key] = criteria[key];
            }
        }
        
        if(criteria.page != null && criteraCount > 0 && newValue[1] == oldValue[1]) {
            delete criteria.page;
        }
        
        $location.search(criteria);
	};
    
    // Remove any commits older than three months if in predictive mode
    $scope.$watch('display.type', function(newVal, oldVal) {
    	if(newVal === 'predictive') {
    		$scope.display.metricKey = "glmc";
    		$scope.show_commit_body = false;
    	} else if($scope.displayAfterTimestamp != 0) {
    		$scope.display.metricKey = "median";
    		$scope.show_commit_body = false;
    	}
    });

    $scope.search = angular.extend({}, $stateParams);
    delete $scope.search.name;
    delete $scope.search.limit;
    delete $scope.search.page;
    delete $scope.search.sort;
    delete $scope.search.type;

    var criteriaCount = 0;
    for(var key in $scope.search) {
        if($scope.search[key] === null) {
            $scope.search[key] = "";
        } else {
            criteriaCount++;
        }
    }

    if(criteriaCount > 0) {
        $scope.showFilterCommits = true;
    }
	//handleCommitSearch();
	
    $scope.currentPage = $stateParams.page - 1 || 0;
    $scope.pageSize = $stateParams.limit || 20;
    $scope.numberOfPages=function(){
        return Math.ceil($scope.repo.commitCounts.total/ $scope.pageSize);                
    };
    
	$scope.$watch('[display, currentPage, pageSize]', handleCommitSearch, true);
    
    $scope.handleCommitSearch = handleCommitSearch.bind(null, 0, 1);
	
	$scope.submitFeedback = function(commit) {
		if(commit.feedback.$valid) {
			socket.post('/feedback/submit/' + commit.commit_hash, {
				score: commit.feedback.score,
				comment: commit.feedback.comment
			}, function(response) {
				$scope.$apply(function() {
					if(response.success) {
						$scope.globalMessages.push({
							type: 'success',
							content: 'Thanks for your feedback!'
						});
					} else {
						$scope.globalMessages.push({
							type:'danger',
							content:'There was an error in submiting your feedback'
						});
					}
				});
			});
		} else {
			$scope.globalMessages.push({
				type: 'danger',
				content: 'Please at least submit either a thumbs up or thumbs down'
			});
		}
	};


    $scope.show_warning_body = false;
    $scope.show_commit_body = false;
    $scope.show_commit_body_options = [{
    	value: false, 
    	label: "Headings Only"
    },{
    	value: true, 
    	label: "Full Details"
    }];
    
    $scope.display_type_options = [{
    	value: 'historical',
    	label: 'Historical Data'
    }, {
    	value: 'predictive',
    	label: 'Predictive Data'
    }];
    
    // Check if glmc has been calculated
    if($scope.repo.metrics.glmc == null || !$scope.repo.metrics.glmc.hasOwnProperty("repo")) {
    	$scope.display_type_options = $scope.display_type_options.splice(0, 1);
    }
    
    $scope.ms_filter = '';
});

angular.module('cg').controller('RepoController', function($scope, $state, $stateParams, socket, messageHandler, repoData) {
	$scope.metricValues = {
			ns: "# of modified subsystems",
			nd: "# of modified directories",
			nf: "# of modified files",
			entrophy: "Entropy (distribution)",
			la: "Lines added",
			ld: "Lines deleted",
			lt: "Total lines",
			ndev: "# of devs contributing",
			age: "Age from last change",
			nuc: "# of unique changes",
			exp: "Dev experience",
			rexp: "Recent dev experience",
			sexp: "Subsystem dev experience",	
	};

	$scope.metricDescriptionValues = {
			ns: "The number of subsystems touched by the commit. Commits modifying many subsystems are more likely to be risky\n\n",
			nd: "The number of directories touched by the commit. Commits modifying many directories are more likely to be risky\n\n",
			nf: "The number of files touched by the commit. Commits modifying many files are more likely to be risky\n\n",
			entrophy: "The distribution of the change across the different files. Commits where the change is evenly distributed across all files will have high entropy and vice versa. Commits with high entropy are more likely to be risky since a developer will have to recall and track large numbers of scattered changes across each file\n\n",
			la: "The number of lines of code added by the commit. The more lines of code added, the more risky a commit is\n\n",
			ld: "The number of lines of code deleted by the commit. The more lines of code deleted, the more risky a commit is\n\n",
			lt: "The number of lines of code in a file before the commit is made. For commits that touch multiple files, we use the average lines of code. Commits that touch large files are more risky\n\n",
			ndev: "The total number of developers that modified the touched files in the past. Commits that touch files with a high number of developers are more risky\n\n",
			age: "The average time interval between the last and the current change in days. For commits that touch multiple files, we measure the average of all files. The higher the age (i.e., more time elapsed), the more risky a commit is\n\n",
			nuc: "The number of unique changes to the files touched by the commit. Commits with more files are considered to be more risky\n\n",
			exp: "The number of commits made by the developer before the current commit. Commits made by less experienced developers are more risky\n\n",
			rexp: "The total experience of the developer in terms of commits, weighted by their age (more recent commit have a higher weight). Commits made by a developer with high relevant experience are less risky\n\n",
			sexp: "The number of commits the developer made in the past to the subsystems that are touched by the current commit. Commits made by a developer with high subsystem experience are less risky\n\n",	
	};

	$scope.metricKeys = Object.keys($scope.metricValues);
	
	$scope.metricGroups = [
		{
			name: 'Size',
			metricKeys: ['la', 'ld', 'lt']
		}, {
			name: 'History',
			metricKeys: ['ndev', 'age', 'nuc']
		}, {
			name: 'Diffusion',
			metricKeys: ['ns', 'nd', 'nf', 'entrophy']
		}, {
			name: 'Experience',
			metricKeys: ['exp', 'rexp', 'sexp']
		}
	];
	
	
	var registerMH = messageHandler.controllerRegister($scope);
	
	$scope.repo = repoData;
	$scope.showRepo = ($scope.repo.analysis_date != '');
	
	if(!$scope.showRepo) {
		registerMH({
			model: 'repository',
			verb: 'update',
			id: $scope.repo.id,
			callback: function(data) {
				if(data.hasOwnProperty('status')) {
					if($scope.repo.status != 'Analyzed' && data.status == 'Analyzed') {
						var current = $state.current;
			            var params = angular.copy($stateParams);
			            $state.transitionTo(current, params, { reload: true, inherit: true, notify: true });
					}
				}
				$scope.repo = angular.extend($scope.repo, data);
			}
		});
	}
});
angular.module('cg').controller('RepoOptionsController', function($scope, $window) {
	
	$scope.downloadDump = function() {
		$window.location = "http://data.commit.guru/dumps/" + $scope.repo.id + ".csv";
	};
});
angular.module('cg').directive('commitPagination', function() {
	return {
		restrict: 'A',
		template: '<div class="form-group">' +
			'<button class="btn btn-default" ng-disabled="currentPage == 0" ng-click="currentPage=currentPage-1">Previous</button>' +
			' Page {{currentPage+1}} ' +
			'<button class="btn btn-default" ' + 'ng-disabled="commits.length < pageSize" ' + ' ng-click="currentPage=currentPage+1">Next</button>' +
			'</div>'
	};
});
angular.module('cg').directive('containsBug', function() {
	return {
		restrict: 'A',
		transclude:true,
		template: '<canvas scroll-activate="data = staged_data" doughnutchart data="data" options="options" height="height" width="width"></canvas>',
		link: {
			pre: function(scope, elm, attrs) {
				scope.staged_data = [{
					value: scope.repo.commitCounts.contains_bug,
					color: 'rgb(242, 222, 222)'
				},
				{
				    value: scope.repo.commitCounts.total - scope.repo.commitCounts.contains_bug,
					color: 'rgb(223, 240, 216)'
				}];
				if(!attrs.size) {
					scope.height = 160;
					scope.width = 200;
				} else {
					scope.height = +attrs.size / 1.25;
					scope.width = +attrs.size;
				}
				scope.data = [];
				scope.options = {};
			}
		}
	};
});
angular.module('cg').directive('debug', function() {
	return {
		restrict: 'E',
		scope: {
			val: '='
		},
		template: '<pre>{{val | json}}</pre>'
	};
});
angular.module('cg').directive('metric', function() {
	return {
		restrict: 'A',
		transclude:true,
		template: '<div class="alert" ng-class="metricClass" ng-bind="value | round"></div><div ng-transclude></div>',
		link: {
				pre: function(scope, elm, attrs) {
					scope.$watch('display.type', function(newVal) {
						scope.value =  scope.commit[scope.key];
						if(newVal !='predictive') {
							if(scope.value >= scope.repo.metrics.median[scope.key + 'buggy'] ) scope.metricClass="alert-danger";
							else if(scope.value >= scope.repo.metrics.median[scope.key + 'nonbuggy'] ) scope.metricClass="alert-warning";
							else scope.metricClass="alert-success";
						} else {
							if(scope.repo.metrics[scope.display.metricKey][scope.key + '_sig']) {
								if(scope.commit.glm_probability > .5) scope.metricClass="alert-danger";
								else if(scope.commit.glm_probability > .25 ) scope.metricClass="alert-warning";
								else scope.metricClass="alert-success";
							} else {
								scope.metricClass = "alert-default";
							}
						}
					});
				}
		}
	};
});
angular.module('cg').directive('metricChart', function() {
	
	var Hcolors = {
		below: '#468847',
		between: '#C09853',
		above: '#B94A48',
	};
	
	return {
		restrict: 'A',
		link: {
			pre: function(scope, elm, attrs) {
				scope.$watch('display.type', function() {
					
					var metricKey = scope.metricKey;
					if(metricKey) {
						if(scope.display.type == 'historical') {
							
							var data = scope.commit[metricKey];
							var above = scope.repo.metrics.individual[metricKey + 'buggy'];
							var below = scope.repo.metrics.individual[metricKey + 'nonbuggy'];
							var sig = scope.repo.metrics.individual[metricKey + '_sig'];
							var max = scope.repo.metrics.maximums[metricKey];
							
							var dataColor = (data.threshold == 0)? Hcolors.between:((data.threshold == 1)? Hcolors.above: Hcolors.below);
							
							scope.metricChartData = {
								data: {
									value: Math.round(data.value * 100) / 100,
									color: dataColor,
									label: scope.metricValues[metricKey] + (sig?'*':'')
								},
								ranges: [{
									value: Math.round(above * 100) / 100,
									color: Hcolors.above,
								}, {
									value: Math.round(below * 100) / 100,
									color: Hcolors.below,
								}],
								scale: max
							};
						} else if (scope.display.type == 'predictive') {
							
							var data = scope.commit[metricKey];
							var max = scope.repo.metrics.maximums[metricKey];
							var sig = scope.repo.metrics.glmc[metricKey + '_sig'];
							var dataColor = sig? 'blue':'lightblue';
							
							scope.metricChartData = {
								data: {
									value: Math.round(data.value * 100) / 100,
									color: dataColor,
									label: scope.metricValues[metricKey] + (sig?'*':'')
								},
								ranges: [],
								scale: max
							};
						}
					}
				});
			}
		}
	};
});
angular.module('cg').directive('metricHistory', function() {
	return {
		restrict: 'A',
		transclude:true,
		scope: {
			metricHistory:'=',
			type: '='
		},
		template: '<canvas linechart data="data" options="options" height="height" width="width"></canvas>',
		link: {
			pre: function(scope, elm, attrs) {
				//scope.data = {}
				
				scope.$watch('type', function(type) {
					scope.data = {
						labels: scope.metricHistory.ids,
						datasets: [
						{
							data: scope.metricHistory.values[scope.type],
							fillColor: 'rgba(223, 240, 216, .5)',
							strokeColor: 'rgba(223, 240, 216, 1)',
							pointColor: 'rgba(223, 240, 216, 1)',
							pointStrokeColor: '#fff'
						}]
					};
				});
				scope.height = 300;
				scope.width = null;
				scope.options = {
					scaleOverride: true,
					scaleSteps: 10,
					scaleStepWidth: .1,
					scaleStartValue: 0,
					scaleLabel : "<%=value * 100%>%"
				};
			}, post: function(scope) {
				scope.$broadcast('startDraw');
			}
			
		}
	};
});
angular.module('cg').directive('metricSummary', function() {
	return {
		restrict: 'A',
		transclude:true,
		scope: {
			metricSummary:'=',
			size: '@'
		},
		template: '<canvas scroll-activate="data = staged_data" doughnutchart data="data" options="options" height="height" width="width"></canvas>',
		link: {
			pre: function(scope, elm, attrs) {
				scope.staged_data = [{
					value: scope.metricSummary.below,
					color: 'rgb(223, 240, 216)'
				},
				{
					value: scope.metricSummary.between,
					color: 'rgb(252, 248, 227)'
				},
				{
					value: scope.metricSummary.above,
					color: 'rgb(242, 222, 222)'
				}];
				if(!scope.size) {
					scope.height = 160;
					scope.width = 200;
				} else {
					scope.height = + scope.size / 1.25;
					scope.width = + scope.size;
				}
				scope.data = [];
				scope.options = {};
			}
		}
	};
});
angular.module('cg').directive('pinned', function() {
	return {
		restrict: 'A',
		link: function(scope, elm, attrs) {
			$(elm).affix({
				offset: {
					top: 50,
					bottom: 0
				}
			}).on('affixed.bs.affix', function() {
				console.log('AFFIXXED!');
				elm.addClass('show-site-title');
			}).on('affixed-top.bs.affix', function() {
				console.log('TOP-AFFIXXED!');
				elm.removeClass('show-site-title');
			});
		}
	};
});
angular.module('cg').directive("scrollActivate", function ($window, $timeout) {
	var elements = [];
	var win = angular.element($window);
	var checkElm = function(elm, i) {
		if (elm.triggered == false && elm.element.offset().top <= win.scrollTop() + win.height()) {
			elm.triggered = true;
			setTimeout(function() {
				elm.scope.$eval(elm.expression);
				elm.scope.$apply();
				if(i !== false) {
					elements.splice(elements.indexOf(elm), 1);
				}
			}, 200);
			return true;
		} else {
			return false;
		}
	};
	var addElm = function(elm) {
		setTimeout(function() {
			if(!checkElm(elm, false)) {
		    	elements.push(elm);
			}
		}, 300);
	};
	win.bind("scroll", function() {
		elements.forEach(checkElm);
	});
    return function(scope, element, attrs) {
    	addElm({
    		scope: scope,
    		element: angular.element(element),
    		expression: attrs.scrollActivate,
    		triggered: false
    	});
    };
});
angular.module('cg')

/**
 * Show how long ago something happend
 */
.filter('timeFormat_fromNow', function(moment) {
	return function(input) {
		return moment(input).fromNow();
	};
})

/**
 * Format a calendar date
 */
.filter('timeFormat_calendar', function(moment) {
	return function(input) {
		return moment(input).calendar();
	};
}).filter('timeFormat_calendar', function(moment) {
	return function(input) {
		return moment(input).format("MMMM Do YYYY, h:mm a");
	};
});
angular.module('cg')

/**
 * Calculates the percent of a total
 */
.filter('percentof', function() {
	return function(input, total) {
		return Math.round((+input) / (+total) * 100);
	};
})

/**
 * Rounds to the correct number of places
 */
.filter('round', function() {
	return function(input, places) {
		if(typeof places == 'undefined')
			places = 100;
		else
			places = Math.pow(10, places);
		return Math.round(input * places) / places;
	};
})

/**
 * Starts an array from a certain index
 */
.filter('startFrom', function() {
	return function(input, start) {
		start = +start; // parse to int
		return input.slice(start);
	};
})

/**
 * Capitializes the first letter of a string
 */
.filter('capitalizeFirst', function() {
	return function(input) {
		return input.charAt(0).toUpperCase() + input.slice(1);
	};
})

/**
 * Converts a decimal to a percent and rounds it to the nearest whole number
 */
.filter('decimalToPercent', function($filter) {
	
	var roundFn = $filter('round');
	
	return function(input) {
		return roundFn(input * 100, 0) + '%';
	};
})

/**
 * Sorts metrics by their significance
 */
.filter('sortBySignificance', function($filter) {
	
	var orderByFilter = $filter('orderBy');
	
	return function(input, lookup) {
		return orderByFilter(input, function(key) {
			return -lookup[key + '_sig'];
		});
	};
});
angular.module('cg').service('messageHandler', function(socket) {

	// A simple array remove tool preparing to be scoped when a handler is register 
	var unregister = function(callback_ptr) {
		this.splice(this.indexOf(callback_ptr), 1);
	},
	
	// Init the mH, short for messageHandler because it is used so much
	mH = {
		_handlers: {}
	};
	
	/**
	 * Register a message handler
	 * @param options Object{model, id, verb} The conditions to listen for
	 * @param callback() Function What to execute when the conditions are met from a message
	 */
	mH.register = function(options, callback) {
		
		// Traverse the model -> id -> verb tree
		// and create any node that hasn't already been created.
		if(mH._handlers.hasOwnProperty(options.model)) {
			if(mH._handlers[options.model].hasOwnProperty(options.id)) {
				if(mH._handlers[options.model][options.id].hasOwnProperty(options.verb)) {
					mH._handlers[options.model][options.id][options.verb].push(callback);
				} else {
					mH._handlers[options.model][options.id][options.verb] = [callback];
				}
			} else {
				mH._handlers[options.model][options.id] = {};
				mH._handlers[options.model][options.id][options.verb] = [callback];
			}
		} else {
			mH._handlers[options.model] = {};
			mH._handlers[options.model][options.id] = {};
			mH._handlers[options.model][options.id][options.verb] = [callback];
		}
		
		// Use the power of Function.bind to scope the unregister function in 
		// the callback queue for that verb
		callback.unregister = unregister.bind(mH._handlers[options.model][options.id][options.verb], callback);
		return callback.unregister;
	},
	
	/**
	 * Handle an incoming message from the websocket
	 * @param message Object The incoming message
	 */
	mH.handle = function(message) {
		
		// Traverse the model -> id -> verb tree and look for any handlers
		if(mH._handlers.hasOwnProperty(message.model)) {
			if(mH._handlers[message.model].hasOwnProperty(message.id)) {
				if(mH._handlers[message.model][message.id].hasOwnProperty(message.verb)) {
					var callbacks = mH._handlers[message.model][message.id][message.verb];
					// Loop through the found callbacks and execute them
					for(var i = 0, l = callbacks.length; i < l; i ++) {
						
						// If a callback returns false, stop executing the
						// other callbacks as a safety (much like events)
						if(!callbacks[i](message.data)) {
							break;
						}
					}
				}
			}
		}
		
		// Silently ignore any messages without handlers for now.
	};
	
	// Here is where we actually listen to the socket
	socket.on('message', mH.handle);
	
	// Return a simple abstraction for registering, and provide an easy way to
	// keep registration in the lifetime of a controller.
	return {
		register: mH.register,
		controllerRegister: function(scope) {
			// Keep track of the callbacks assigned
			var handler_callbacks = [];
			
			// If controller is deleted, unregister each of the callbacks
			scope.$on("$destroy", function(){
				for(var i = 0; i < handler_callbacks.length; i++) {
					handler_callbacks[i].unregister();
				}
		    });
			
			// Return a re-usable function
			return function(handler) {
				
				// Prepare the callback to be run inside a digest loop
				var handler_callback = function(data) {
					scope.$apply(function() {
						handler['callback'](data);
					});
				};
				
				// Remember the callback so it can be unregistered later
				handler_callbacks.push(handler_callback);
				
				// Register the handler and it's callback, return the
				// unregister method of the callback
				return mH.register(handler, handler_callback);
			};
		}
	};
});

/**
 * Handles responses and their errors
 */
angular.module('cg')
		.factory(
			'responseHandler',
			function($filter) {

				/*
				 * Wrap the response Handler in a scope
				 */
				return function($scope) {
					/**
					 * Handle an error
					 * @param action String the action that was performed
					 * @param details
					 * @returns
					 */
					var handleError = function(action, details) {
						if(typeof details == 'object') {
							details = $filter('json')(details);
						}
						$scope.globalMessages.push({
							type: 'danger',
							content: action + ': ' + details
						});
					};

					/**
					 * Returns a request handeler
					 * 
					 * @param response Object The response object
					 * @param {function} successFn The function to call upon success
					 * @param {?(function | boolean | string)} errorFn   
					 */
					return function(response, successFn, errorFn) {

						// Wrap in an apply block
						$scope.$apply(function() {

							// If successful, call the success callback
							if(response.success) {
								successFn(response);
							} else {

								// Check if there is a callback function, then call it
								if(typeof errorFn == "function") {
									errorFn(response.error);
								} else if(typeof errorFn == "string") {
									handleError(errorFn, response.error);
								} else if((typeof errorFn == "boolean" && errorFn !== false)
									|| typeof errorFn == "undefined") {
									handleError('Error', response.error);
								}

								// If the errorFn is set to false, fail silently
							}
						});
					};
				};
			});

angular.module('cg')

/*
 * Load a repo over a socket connection
 */
.factory('commitLoader', function($q, socket) {

    return function(params) {
        var defer = $q.defer();
        socket.get('/repo/' + params.name + '/commits', 
            params?params:{},
            function(response) {
                if(response.success) {
                    defer.resolve(response.commits);
                } else {
                    defer.reject(response.error);
                }
            }
        );		
        return defer.promise;
    };
});
angular.module('cg')

/*
 * Angularize moment-js.
 */
.factory('moment', function($window) {
	// TODO: This needs to be a *little* better
	return $window.moment;
});
angular.module('cg')

/*
 * Load a repo over a socket connection
 */
.factory('repoLoader', function($q, socket) {
	
	return function(name) {
		var defer = $q.defer();
		socket.get('/repo/' + name, 
			function(response) {
				if(response.success) {
					defer.resolve(response.repo);
				} else {
					defer.reject(response.error);
				}
			}
		);		
		return defer.promise;
	};
});
angular.module('cg').factory('socket', function ($rootScope) {
	  var socket = io.connect(':' + APP_PORT);
	  return socket;
	  /*
	  return {
	    on: function (eventName, callback) {
	      socket.on(eventName, function () {  
	        var args = arguments;
	        $rootScope.$apply(function () {
	          callback.apply(socket, args);
	        });
	      });
	    },
	    emit: function (eventName, data, callback) {
	      socket.emit(eventName, data, function () {
	        var args = arguments;
	        $rootScope.$apply(function () {
	          if (callback) {
	            callback.apply(socket, args);
	          }
	        });
	      })
	    }
	  };*/
	})