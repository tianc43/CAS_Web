/**
 * Created by louisq on 16/12/15.
 */


module.exports = {
    tableName: 'static_warnings',
    migrate: 'safe',
    autoCreatedAt: false,
    autoUpdatedAt: false,
    autoPK: false,
    attributes: {
        SFP: {
            type: 'STRING'
        },
        CWE: {
            type: 'STRING'
        },
        valid: {
            type: 'STRING'
        },
        trust: {
            type: 'STRING'
        },
        resource: {
            type: 'STRING'
        },
        line_number: {
            type: 'STRING'
        },
        kdm_line_number: {
            type: 'STRING'
        },
        generator_tool: {
            type: 'STRING'
        },
        weakness_description: {
            type: 'STRING'
        }
    }
};

