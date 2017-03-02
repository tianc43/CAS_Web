var CommitController = {
    find: function (req, res) {
        
        var repo_name = req.params.name;

        // Get the repository
        Repository.findOne({name:repo_name}).done(function(err, repo) {

            // ERROR CHECKING FOR REPO
            if(err) {
                sails.log.error(err);
                return res.json({success: false, error: err});
            } else if(typeof repo === "undefined") {

                // Repository does not exist
                return res.json({success:false, 
                                 error:'404: Repository not found'});
            }
            
            // REPO is valid
            
            var paginationOptions = {
                page: (+req.param('page')) || 0,
                limit: (+req.param('limit')) || 20
            };

            sails.log.info(paginationOptions);
            
            var critera = {
                commit_hash: {like: null},
                classification: {like: null},
                author_email: {like: null},
                commit_message: {like: null}
            };
            
            var criteriaCount = 0;
            var result = null;
            for(var key in critera) {
                criteriaCount++;
                if((result = req.param(key)) !== null) {
                    critera[key].like = "%" + result + "%";
                    criteriaCount++;
                } else {
                    delete critera[key];
                }
            }
            
            var type = req.param('type');
            if(type == 'predictive') {
                var d = new Date();
                d.setMonth(d.getMonth() - 3);
                critera.author_date_unix_timestamp = {'>=': d.getTime()};
            }
            
            var sortParam = req.param('sort');
            var sort = '';
            if(sortParam !== null) {
                
                var sortModifier = sortParam.substr(0, 1);
                var sortDESC = (sortModifier != '+');
                var sortType = (sortDESC && sortModifier != "-")? sortParam: sortParam.substr(1);
                
                if(sortType == 'risk') {
                    sort = "glm_probability";
                } else if(sortType == 'time') {
                    sort = "author_date_unix_timestamp";
                } else {
                    sort = false;
                }
                
                if(sort) {
                    sort += (sortDESC)? " DESC": " ASC";
                }
            }
            
            if(!sort) {
                sort = 'author_date_unix_timestamp DESC';
            }

            var Promise = require('bluebird');
            var userQueryAsync = Promise.promisify(Commit.query);
            var queryStr = "SELECT * FROM COMMITS " +
                " WHERE REPOSITORY_ID = '" + repo.id + "' " +
                " ORDER BY " + sort +
                " LIMIT " + (paginationOptions.limit+1) + // TODO +1 work around for next page
                " OFFSET " + (paginationOptions.page-1) * paginationOptions.limit;
/*
            var joinFiles = "SELECT * FROM (" +
                queryStr +
                ") as sel, files" +
                " WHERE files.commit_hash = sel.commit_hash" +
                " AND files.repository_id = sel.repository_id";
                */
            /*

             "SELECT repository_id, commit_hash, author_name, author_date_unix_timestamp, author_email, " +
             " author_date, commit_message, fix, linked, contains_bug, fixes, ns, nd, nf, entrophy, la, ld, " +
             " fileschanged, lt, ndev, age, nuc, exp, rexp, sexp, glm_probability, STATIC_COMMIT_LINE_WARNING.repo, " +
             " STATIC_COMMIT_LINE_WARNING.resource, STATIC_COMMIT_LINE_WARNING.line, sfp, cwe, valid, trust, " +
             " generator_tool, weakness, created, origin_commit, origin_resource, origin_line, is_new_line FROM (" +
             */
            var outerJoin = "SELECT repository_id, commit_hash, author_name, author_date_unix_timestamp, author_email, " +
                " author_date, commit_message, fix, linked, contains_bug, classification, fixes, ns, nd, nf, entrophy, la, ld, " +
                " fileschanged, lt, ndev, age, nuc, exp, rexp, sexp, glm_probability, STATIC_COMMIT_LINE_WARNING.repo, " +
                " STATIC_COMMIT_LINE_WARNING.resource, STATIC_COMMIT_LINE_WARNING.line, sfp, cwe, valid, trust, " +
                " generator_tool, weakness, origin_commit, origin_resource, origin_line, is_new_line, status, build FROM (" +
                queryStr +
                ") as all_files " +
                    " LEFT JOIN STATIC_COMMIT_PROCESSED ON (STATIC_COMMIT_processed.repo = all_files.REPOSITORY_ID and all_files.commit_hash = STATIC_COMMIT_processed.commit) " +
                " LEFT JOIN STATIC_COMMIT_LINE_WARNING " +
                " ON (all_files.commit_hash = STATIC_COMMIT_LINE_WARNING.commit and STATIC_COMMIT_LINE_WARNING.repo = all_files.REPOSITORY_ID) " +
                " LEFT JOIN STATIC_COMMIT_LINE_BLAME " +
                " ON (all_files.commit_hash = STATIC_COMMIT_LINE_BLAME.commit " +
                " and STATIC_COMMIT_LINE_BLAME.repo = all_files.REPOSITORY_ID " +
                " and STATIC_COMMIT_LINE_WARNING.resource = STATIC_COMMIT_LINE_BLAME.resource " +
                " and STATIC_COMMIT_LINE_WARNING.line = STATIC_COMMIT_LINE_BLAME.line)" +
                " ORDER BY " + sort;

            var warningsJoin = "SELECT * FROM ";

            // Need to take into account the commit_hash and repository_id

            sails.log.info("Query: " + outerJoin);
            var query = userQueryAsync(outerJoin);
            //var query = Commit.find({repository_id: repo.id});
            //if(criteriaCount > 0) {
            //    query.where(critera);
            //}
            //query.paginate(paginationOptions)
            //.sort(sort)
            //.done(function(err, commits){

            query.then(function(commits){

                commits = commits.rows;
                //sails.log.info(commits);

                // ERROR CHECKING FOR COMMITS
                // TODO need to make sure that errors are still handled
                if(err) {
                    sails.log.error(err);
                    return res.json({success: false, error: err});
                } else if(commits.length == 0) {

                    // No commits in the repo

                    return res.json({success: true, commits: []});			
                }

                // COMMITS VALID
                parsedCommits = {};
                parsedCommitHashes = [];

                // Loop through each commit
                for(var i = 0, l = commits.length; i < l; i++) {

                    if (parsedCommitHashes.indexOf(commits[i].commit_hash) < 0){
                        commits[i]['staticWarnings'] = {};

                        // Normalize the fileschanged
                        commits[i].fileschanged = JSON.parse(commits[i].fileschanged);

                        commits[i].fileschanged.forEach(function(file) {
                            commits[i]['staticWarnings'][file] = []
                        });

                        //sails.log.info(commits[i]);
                        parsedCommits[commits[i].commit_hash] = commits[i];
                        parsedCommitHashes.push(commits[i].commit_hash);
                    }

                    if (commits[i].sfp){
                        //sails.log.info(commits[i]);
                        //sails.log.info(parsedCommits[commits[i].commit_hash]['staticWarnings']);

                        var warning = {
                            line_number: parseInt(commits[i].line, 10),
                            sfp: commits[i].sfp,
                            cwe: commits[i].cwe,
                            generator_tool: commits[i].generator_tool,
                            weakness_description: commits[i].weakness,
                            is_new_line: commits[i].is_new_line,
                            origin_commit: commits[i].origin_commit,
                            origin_resource: commits[i].origin_resource.replace(/^\s+|\s+$/g ,''),
                            origin_line: commits[i].origin_line
                        };
                        //sails.log.info(warning);

                        // TODO bug where file name does not exist

                        try {
                            parsedCommits[commits[i].commit_hash]['staticWarnings'][commits[i]['resource'].substring(1)].push(warning)
                        } catch (err) {

                            sails.log.info(err);

                        }


                    }
                }
                var orderedCommits = [];
                parsedCommitHashes.forEach(function(commit_hash){
                    orderedCommits.push(parsedCommits[commit_hash])
                });
                //sails.log.info(parsedCommits);
                return res.json({success: true, commits: orderedCommits});
            })
        });
    },
}

module.exports = CommitController;
