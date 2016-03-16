/**
 * File
 * 
 * @module :: Model
 * @description :: The commit module for finding commits
 * 
 */

module.exports = {
    tableName: 'files',
    migrate: 'safe',
    autoCreatedAt: false,
    autoUpdatedAt: false,
    autoPK: false,
    attributes: {
        
        // Basic Attributes
        repository_id: {
            type: 'STRING'
        },
        commit_hash: {
            type: 'STRING',
            primaryKey: true
        },
        file_name: {
            type: 'STRING'
        },
        associationProp: {
            model: 'Commit'
        }
    }

};
