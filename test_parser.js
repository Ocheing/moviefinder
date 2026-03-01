const fs = require('fs');
async function test() {
    const text = fs.readFileSync('.env', 'utf8');
    let config = {};
    text.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            config[key] = value;
        }
    });
    console.log('TMDB_API_KEY from env parser is:', '[' + config['TMDB_API_KEY'] + ']', 'Length:', config['TMDB_API_KEY']?.length);
}
test();
