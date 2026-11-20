FROM php:8.3-apache
RUN a2enmod headers \
 && sed -ri 's/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf
COPY . /var/www/html/
RUN mkdir -p /var/www/html/data && chown -R www-data:www-data /var/www/html/data \
 && rm -f /var/www/html/Dockerfile /var/www/html/docker-compose.yml
EXPOSE 80
