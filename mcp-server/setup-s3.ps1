# OneMemory - S3 setup automation script
# Run this from PowerShell inside: C:\dev\onememory\mcp-server

# ---- EDIT THIS: pick a globally-unique bucket name ----
$BUCKET_NAME = "onememory-hackathon-anushka7"
$REGION = "ap-south-1"
# --------------------------------------------------------

Write-Host "Creating bucket: $BUCKET_NAME in $REGION ..."
aws s3api create-bucket `
  --bucket $BUCKET_NAME `
  --region $REGION `
  --create-bucket-configuration LocationConstraint=$REGION

Write-Host "Disabling 'Block Public Access' ..."
aws s3api put-public-access-block `
  --bucket $BUCKET_NAME `
  --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

Write-Host "Enabling static website hosting ..."
aws s3api put-bucket-website `
  --bucket $BUCKET_NAME `
  --website-configuration '{\"IndexDocument\":{\"Suffix\":\"index.html\"}}'

Write-Host "Applying public-read bucket policy ..."
$policy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
    }
  ]
}
"@
$policy | Out-File -Encoding ascii bucket-policy.json
aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file://bucket-policy.json

Write-Host "Uploading index.html and memories.json ..."
aws s3 cp index.html "s3://$BUCKET_NAME/index.html" --content-type "text/html"
aws s3 cp memories.json "s3://$BUCKET_NAME/memories.json" --content-type "application/json"

Write-Host ""
Write-Host "DONE. Your live demo URL is:"
Write-Host "http://$BUCKET_NAME.s3-website.$REGION.amazonaws.com"