# Usage: ./cert-gen.sh <floatingIP>

if [[ -z $1 ]] ; then
    echo "ERROR: A floating IP must be supplied."
    echo "Usage: $0 <floatingIP>"
    exit 1
fi

cat > ssl.conf <<EOF
[req]
distinguished_name = $1
x509_extensions = v3_req
prompt = no

[$1]
CN = arvados-test-cert

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
IP.1 = $1
EOF
openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 365 -out certificate.pem -config ssl.conf
rm ssl.conf
